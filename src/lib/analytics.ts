// 简单的统计追踪：view 和 copy
// 使用 sessionStorage 去重 view 事件

const VIEWED_KEY = 'skills_hot_viewed';

function getViewedSlugs(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = sessionStorage.getItem(VIEWED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveViewedSlugs(slugs: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...slugs]));
  } catch {
    // 忽略存储错误
  }
}

export async function trackView(skillSlug: string) {
  // 同一会话只记录一次 view
  const viewed = getViewedSlugs();
  if (viewed.has(skillSlug)) return;

  viewed.add(skillSlug);
  saveViewedSlugs(viewed);

  // 发送到 API（fire and forget）
  fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'view', skill_slug: skillSlug }),
  }).catch(() => {});
}

export async function trackCopy(skillSlug: string) {
  // copy 每次都记录
  fetch('/api/stats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'copy', skill_slug: skillSlug }),
  }).catch(() => {});
}
