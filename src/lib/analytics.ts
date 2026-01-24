// Analytics utility for tracking skill events
// Uses sessionStorage to deduplicate events within a session

const TRACKED_KEY = 'skillbank_tracked';

function getTrackedEvents(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = sessionStorage.getItem(TRACKED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveTrackedEvents(events: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TRACKED_KEY, JSON.stringify([...events]));
  } catch {
    // Ignore storage errors
  }
}

export async function trackEvent(
  skillSlug: string,
  eventType: 'view' | 'copy' | 'install',
  skillId?: string
) {
  // Create unique key for this event
  const eventKey = `${skillSlug}:${eventType}`;

  // Check if already tracked in this session (for view events)
  if (eventType === 'view') {
    const tracked = getTrackedEvents();
    if (tracked.has(eventKey)) {
      return; // Already tracked this view in this session
    }
    tracked.add(eventKey);
    saveTrackedEvents(tracked);
  }

  // Send to API (fire and forget)
  try {
    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skill_slug: skillSlug,
        skill_id: skillId,
        event_type: eventType,
      }),
    }).catch(() => {
      // Silently fail - don't block user experience
    });
  } catch {
    // Silently fail
  }
}
