import { parseBuffer } from 'music-metadata';
import { DropboxService } from './dropbox';

export interface AudioFingerprint {
  filePath: string;
  fileName: string;
  duration: number;
  tempo?: number;
  key?: string;
  timeSignature?: string;
  sampleRate?: number;
  bitrate?: number;
  format?: string;
  fileSize: number;
  modifiedDate: Date;
  // Derived features for clustering
  features: {
    durationCategory: string;
    tempoCategory: string;
    keyGroup: string;
    formatGroup: string;
    filenameTokens: string[];
    dateContext: string;
  };
}

export interface AudioCluster {
  id: string;
  name: string;
  files: AudioFingerprint[];
  averageTempo?: number;
  dominantKey?: string;
  averageDuration: number;
  confidence: number;
  suggestedCategory: 'same_song_takes' | 'similar_ideas' | 'same_session' | 'unrelated';
  createdDate: Date;
}

export class AudioClusteringService {

  constructor(private dropboxService: DropboxService) {}

  /**
   * Extract enhanced audio fingerprint from file metadata
   * Using fast filename-based analysis
   */
  async extractFingerprint(filePath: string, dropboxFile: any, onProgress?: (message: string) => void): Promise<AudioFingerprint> {
    const filename = filePath.split('/').pop() || '';

    onProgress?.(`📝 Analyzing ${filename}...`);

    // Extract filename tokens for similarity analysis
    const filenameTokens = this.extractFilenameTokens(filename);
    const estimatedDuration = this.estimateDurationFromSize(dropboxFile.size);

    const fingerprint: AudioFingerprint = {
      filePath,
      fileName: filename,
      duration: estimatedDuration,
      fileSize: dropboxFile.size || 0,
      modifiedDate: new Date(dropboxFile.server_modified || Date.now()),
      format: this.getFileExtension(filename),
      features: {
        durationCategory: this.categorizeDuration(estimatedDuration),
        tempoCategory: 'unknown', // Will be inferred from clustering
        keyGroup: 'unknown', // Will be inferred from clustering
        formatGroup: this.categorizeFormat(this.getFileExtension(filename)),
        filenameTokens,
        dateContext: this.getDateContext(new Date(dropboxFile.server_modified || Date.now()))
      }
    };

    onProgress?.(`✅ Analyzed ${filename}`);
    return fingerprint;
  }

  /**
   * Download only a portion of the file for metadata extraction
   */
  private async downloadFilePartial(filePath: string, maxBytes: number): Promise<Buffer> {
    try {
      // Use temporary link to download partial content
      const tempLink = await this.dropboxService.getTemporaryLink(filePath);

      const response = await fetch(tempLink, {
        headers: {
          'Range': `bytes=0-${maxBytes - 1}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new Error(`Failed to download partial file: ${error}`);
    }
  }

  /**
   * Estimate duration from file size (rough approximation)
   */
  private estimateDurationFromSize(sizeBytes: number): number {
    if (!sizeBytes) return 0;

    // Rough estimates based on common bitrates
    // MP3 ~128kbps = ~16KB/s, so duration ≈ size / 16000
    // This is very rough but better than 0
    return Math.round(sizeBytes / 16000);
  }

  /**
   * Calculate similarity between two audio fingerprints
   * Optimized for filename-based clustering
   */
  calculateSimilarity(fp1: AudioFingerprint, fp2: AudioFingerprint): number {
    let similarity = 0;
    let weightSum = 0;

    // Filename similarity (highest weight - main clustering factor)
    const filenameSim = this.calculateFilenameSimilarity(fp1.features.filenameTokens, fp2.features.filenameTokens);
    similarity += filenameSim * 0.6; // Increased weight
    weightSum += 0.6;

    // Duration similarity (based on file size estimation)
    if (fp1.duration && fp2.duration && fp1.duration > 0 && fp2.duration > 0) {
      const durationSim = 1 - Math.min(Math.abs(fp1.duration - fp2.duration) / Math.max(fp1.duration, fp2.duration), 1);
      similarity += durationSim * 0.15;
      weightSum += 0.15;
    } else if (fp1.features.durationCategory === fp2.features.durationCategory) {
      similarity += 0.075;
      weightSum += 0.15;
    }

    // Date proximity (same session bonus)
    const timeDiff = Math.abs(fp1.modifiedDate.getTime() - fp2.modifiedDate.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const dateSim = hoursDiff < 1 ? 0.9 : (hoursDiff < 6 ? 0.6 : (hoursDiff < 24 ? 0.3 : 0));
    similarity += dateSim * 0.15;
    weightSum += 0.15;

    // Format similarity
    if (fp1.features.formatGroup === fp2.features.formatGroup) {
      similarity += 0.1;
      weightSum += 0.1;
    }

    return weightSum > 0 ? similarity / weightSum : 0;
  }

  /**
   * Find optimal similarity threshold by testing different values
   */
  findOptimalThreshold(fingerprints: AudioFingerprint[]): number {
    const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    let bestThreshold = 0.6;
    let bestScore = 0;

    for (const threshold of thresholds) {
      const clusters = this.clusterAudioFiles(fingerprints, threshold, false);
      const score = this.evaluateClusterQuality(clusters, fingerprints.length);

      if (score > bestScore) {
        bestScore = score;
        bestThreshold = threshold;
      }
    }

    return bestThreshold;
  }

  /**
   * Evaluate cluster quality based on number of clusters and coverage
   */
  private evaluateClusterQuality(clusters: AudioCluster[], totalFiles: number): number {
    if (clusters.length === 0) return 0;

    const clusteredFiles = clusters.reduce((sum, cluster) => sum + cluster.files.length, 0);
    const coverage = clusteredFiles / totalFiles;
    const avgConfidence = clusters.reduce((sum, cluster) => sum + cluster.confidence, 0) / clusters.length;

    // Balance between having clusters and good confidence
    return coverage * 0.7 + avgConfidence * 0.3;
  }

  /**
   * Cluster audio files based on similarity
   */
  clusterAudioFiles(fingerprints: AudioFingerprint[], threshold?: number, useOptimal: boolean = true): AudioCluster[] {
    // Use optimal threshold if not specified
    if (threshold === undefined && useOptimal) {
      threshold = this.findOptimalThreshold(fingerprints);
      console.log(`Using optimal similarity threshold: ${threshold}`);
    } else if (threshold === undefined) {
      threshold = 0.6;
    }

    const clusters: AudioCluster[] = [];
    const processed = new Set<string>();

    fingerprints.forEach((fp, i) => {
      if (processed.has(fp.filePath)) return;

      // Start new cluster with this file
      const clusterFiles = [fp];
      processed.add(fp.filePath);

      // Find similar files
      fingerprints.forEach((otherFp, j) => {
        if (i !== j && !processed.has(otherFp.filePath)) {
          const similarity = this.calculateSimilarity(fp, otherFp);

          if (similarity >= threshold) {
            clusterFiles.push(otherFp);
            processed.add(otherFp.filePath);
          }
        }
      });

      // Only create cluster if there are multiple files
      if (clusterFiles.length > 1) {
        const cluster = this.createCluster(clusterFiles);
        clusters.push(cluster);
      }
    });

    // Sort clusters by confidence and size
    clusters.sort((a, b) => (b.confidence * b.files.length) - (a.confidence * a.files.length));

    return clusters;
  }

  /**
   * Create a cluster from a group of similar files
   */
  private createCluster(files: AudioFingerprint[]): AudioCluster {
    const id = `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate cluster statistics
    const tempos = files.map(f => f.tempo).filter(Boolean) as number[];
    const averageTempo = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : undefined;

    const durations = files.map(f => f.duration).filter(d => d > 0);
    const averageDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const keys = files.map(f => f.key).filter(Boolean);
    const dominantKey = this.getMostFrequent(keys);

    // Determine cluster name and category
    const { name, category, confidence } = this.analyzeClusterCharacteristics(files);

    return {
      id,
      name,
      files: files.sort((a, b) => a.modifiedDate.getTime() - b.modifiedDate.getTime()),
      averageTempo,
      dominantKey,
      averageDuration,
      confidence,
      suggestedCategory: category,
      createdDate: new Date()
    };
  }

  /**
   * Analyze cluster to determine name and category
   */
  private analyzeClusterCharacteristics(files: AudioFingerprint[]): {
    name: string;
    category: 'same_song_takes' | 'similar_ideas' | 'same_session' | 'unrelated';
    confidence: number;
  } {
    // Analyze filename patterns
    const allTokens = files.flatMap(f => f.features?.filenameTokens || []);
    const tokenCounts = this.countTokens(allTokens);
    const commonTokens = Object.entries(tokenCounts)
      .filter(([_, count]) => count >= Math.ceil(files.length * 0.6))
      .map(([token, _]) => token)
      .filter(token => !this.isCommonWord(token));

    // Check for take/version patterns
    const hasTakePattern = files.some(f =>
      f.features?.filenameTokens?.some(token => /^(take|version|try|attempt|v)\d*$/i.test(token)) || false
    );

    const hasNumberSequence = files.some(f =>
      f.features?.filenameTokens?.some(token => /^\d+$/.test(token)) || false
    );

    // Time clustering
    const timestamps = files.map(f => f.modifiedDate.getTime()).sort();
    const maxTimeDiff = timestamps[timestamps.length - 1] - timestamps[0];
    const isWithinHours = maxTimeDiff < (2 * 60 * 60 * 1000); // 2 hours
    const isWithinDay = maxTimeDiff < (24 * 60 * 60 * 1000); // 24 hours

    // Determine category and confidence
    let category: 'same_song_takes' | 'similar_ideas' | 'same_session' | 'unrelated';
    let confidence: number;
    let name: string;

    if (hasTakePattern || (hasNumberSequence && isWithinHours)) {
      category = 'same_song_takes';
      confidence = 0.9;
      name = commonTokens.length > 0 ?
        `${commonTokens.slice(0, 2).join(' ')} - Takes (${files.length} versions)` :
        `Recording Session - ${files.length} takes`;
    } else if (commonTokens.length >= 2 && isWithinDay) {
      category = 'similar_ideas';
      confidence = 0.7;
      name = `${commonTokens.slice(0, 2).join(' ')} - Variations (${files.length} files)`;
    } else if (isWithinHours) {
      category = 'same_session';
      confidence = 0.6;
      const date = files[0].modifiedDate.toISOString().slice(0, 10);
      name = `Recording Session ${date} (${files.length} files)`;
    } else {
      category = 'unrelated';
      confidence = 0.3;
      name = `Similar Audio (${files.length} files)`;
    }

    return { name, category, confidence };
  }

  // Helper methods
  private getMimeType(filePath: string): string {
    const ext = this.getFileExtension(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac'
    };
    return mimeTypes[ext] || 'audio/mpeg';
  }

  private getFileExtension(filename: string): string {
    return filename.split('.').pop() || '';
  }

  private extractFilenameTokens(filename: string): string[] {
    const tokens = filename
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/^\d{8}_/, '') // Remove first date prefix (20250922_)
      .replace(/^\d{8}_/, '') // Remove second date prefix if exists (20250828_)
      .split(/[\s\-_\.()]+/) // Include parentheses as separators
      .map(token => token.toLowerCase())
      .filter(token => token.length > 0 && token !== '1'); // Keep all meaningful tokens

    // Debug logging for troubleshooting
    if (tokens.length === 0) {
      console.log(`Warning: No tokens extracted from filename: ${filename}`);
    }

    return tokens;
  }

  private categorizeDuration(duration: number): string {
    if (duration < 30) return 'snippet';
    if (duration < 120) return 'short';
    if (duration < 300) return 'medium';
    return 'long';
  }

  private categorizeTempo(bpm?: number): string {
    if (!bpm) return 'unknown';
    if (bpm < 80) return 'slow';
    if (bpm < 120) return 'medium';
    if (bpm < 160) return 'fast';
    return 'very_fast';
  }

  private categorizeKey(key?: string): string {
    if (!key) return 'unknown';
    return key.replace(/\s+(major|minor)/i, '').toLowerCase();
  }

  private categorizeFormat(format?: string): string {
    if (!format) return 'unknown';
    const lossless = ['wav', 'flac', 'aiff'];
    const compressed = ['mp3', 'aac', 'm4a', 'ogg'];

    if (lossless.includes(format.toLowerCase())) return 'lossless';
    if (compressed.includes(format.toLowerCase())) return 'compressed';
    return 'other';
  }

  private getDateContext(date: Date): string {
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  private calculateFilenameSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  private countTokens(tokens: string[]): { [token: string]: number } {
    return tokens.reduce((counts, token) => {
      counts[token] = (counts[token] || 0) + 1;
      return counts;
    }, {} as { [token: string]: number });
  }

  private getMostFrequent(items: string[]): string | undefined {
    if (items.length === 0) return undefined;
    const counts = this.countTokens(items);
    return Object.entries(counts).reduce((a, b) => counts[a[0]] > counts[b[0]] ? a : b)[0];
  }

  private isCommonWord(token: string): boolean {
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'song', 'track', 'audio', 'recording'];
    return commonWords.includes(token.toLowerCase());
  }
}