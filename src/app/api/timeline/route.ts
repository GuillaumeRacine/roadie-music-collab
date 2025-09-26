import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/config';
import { getAuthFromCookies } from '@/lib/session';
import { activityLogger } from '@/lib/activity-log';

export async function GET(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const filePath = searchParams.get('filePath');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const action = searchParams.get('action');

    let activities;

    if (filePath) {
      // Get activities for a specific file
      activities = await activityLogger.getActivitiesForFile(filePath);
    } else if (startDate && endDate) {
      // Get activities in date range
      activities = await activityLogger.getActivitiesByDateRange(startDate, endDate);
    } else {
      // Get recent activities
      activities = await activityLogger.getActivities(limit, offset);
    }

    // Filter by action if specified
    if (action) {
      activities = activities.filter(activity => activity.action === action);
    }

    // Add some statistics
    const stats = {
      totalActivities: activities.length,
      actionCounts: activities.reduce((acc: {[key: string]: number}, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
        return acc;
      }, {}),
      dateRange: activities.length > 0 ? {
        earliest: activities[activities.length - 1]?.timestamp,
        latest: activities[0]?.timestamp
      } : null
    };

    return NextResponse.json({
      activities: activities.slice(0, limit),
      stats,
      pagination: {
        limit,
        offset,
        hasMore: activities.length > limit + offset
      }
    }, { headers: getCorsHeaders() });

  } catch (error: any) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch timeline' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authTokens = getAuthFromCookies(request);
    if (!authTokens?.access_token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: getCorsHeaders() }
      );
    }

    const { action } = await request.json();

    if (action === 'cleanup') {
      // Clean up old log entries
      await activityLogger.clearOldLogs(30); // Keep 30 days
      return NextResponse.json({
        message: 'Activity log cleaned up successfully'
      }, { headers: getCorsHeaders() });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400, headers: getCorsHeaders() }
    );

  } catch (error: any) {
    console.error('Error managing timeline:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to manage timeline' },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: getCorsHeaders() });
}