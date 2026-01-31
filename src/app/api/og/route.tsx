import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import enMessages from '../../../../messages/en.json';
import zhMessages from '../../../../messages/zh.json';

export const runtime = 'edge';

const messages = { en: enMessages, zh: zhMessages } as const;
type Locale = keyof typeof messages;

// Newspaper theme colors
const COLORS = {
  light: {
    background: '#FAFAF8',
    foreground: '#1A1A1A',
    muted: '#666666',
    border: '#E8E8E6',
    accent: '#C41E3A',
    gold: '#B8860B',
    cardBg: '#F5F5F3',
  },
  dark: {
    background: '#121212',
    foreground: '#E8E8E6',
    muted: '#888888',
    border: '#2A2A2A',
    accent: '#FF6B6B',
    gold: '#FFD700',
    cardBg: '#1E1E1E',
  },
};

type PageType = 'default' | 'skill' | 'author' | 'docs' | 'search';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const title = searchParams.get('title') || 'Skills Hot';
  const subtitle = searchParams.get('subtitle') || '';
  const locale = searchParams.get('locale') || 'en';
  const type = (searchParams.get('type') || 'default') as PageType;
  const theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';

  // Shared stats params
  const installs = searchParams.get('installs') || '';
  const stars = searchParams.get('stars') || '';
  const rank = searchParams.get('rank') || '';

  // Author-specific params
  const skills = searchParams.get('skills') || '';
  const avatar = searchParams.get('avatar') || '';

  // Skill-specific params
  const author = searchParams.get('author') || '';
  const source = searchParams.get('source') || ''; // local, github

  const colors = COLORS[theme];
  const isTopOne = rank === '1';
  const loc = (locale === 'zh' ? 'zh' : 'en') as Locale;
  const t = messages[loc].seo.og;
  const tMetadata = messages[loc].metadata;

  const tagline = tMetadata.description.split('.')[0]; // Use first sentence of description

  // Get section label based on type
  const getSectionLabel = () => {
    const labels: Record<PageType, { en: string; zh: string }> = {
      default: { en: 'MARKETPLACE', zh: '技能市场' },
      skill: { en: 'SKILL', zh: '技能' },
      author: { en: 'AUTHOR', zh: '作者' },
      docs: { en: 'DOCUMENTATION', zh: '文档' },
      search: { en: 'SEARCH', zh: '搜索' },
    };
    return loc === 'zh' ? labels[type].zh : labels[type].en;
  };

  // Skill page with stats
  if (type === 'skill' && installs) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: isTopOne
              ? `linear-gradient(135deg, ${colors.background} 0%, ${theme === 'light' ? '#FFF8E7' : '#1a1a10'} 100%)`
              : colors.background,
            padding: '60px 80px',
            position: 'relative',
          }}
        >
          {/* Top #1 banner for trending skills */}
          {isTopOne && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: `linear-gradient(90deg, ${colors.accent} 0%, ${colors.gold} 50%, ${colors.accent} 100%)`,
              }}
            />
          )}

          {/* Top bar with logo */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              paddingBottom: '20px',
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>🔥</span>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: colors.foreground,
                  letterSpacing: '-0.02em',
                }}
              >
                Skills Hot
              </span>
            </div>

            {/* Source badge */}
            {source && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  background: source === 'github' ? '#24292e' : colors.accent,
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                {source === 'github' ? '⚡ GITHUB' : '🏠 PLATFORM'}
              </div>
            )}

            {isTopOne && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: colors.gold,
                  color: '#1A1A1A',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                🔥 {t.trending}
              </div>
            )}
          </div>

          {/* Double line divider */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
            <div style={{ height: '2px', background: isTopOne ? colors.accent : colors.foreground, width: '100%' }} />
            <div style={{ height: '3px', background: 'transparent' }} />
            <div style={{ height: '1px', background: isTopOne ? colors.accent : colors.foreground, width: '100%' }} />
          </div>

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              gap: '20px',
              paddingTop: '40px',
              paddingBottom: '40px',
            }}
          >
            {/* Section label with line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: isTopOne ? colors.accent : colors.muted,
                }}
              >
                {isTopOne ? (`🔥 ${t.trendingSkill}`) : getSectionLabel()}
              </span>
              <div style={{ height: '1px', flex: 1, background: colors.border }} />
            </div>

            {/* Skill name */}
            <h1
              style={{
                fontSize: title.length > 25 ? '52px' : '64px',
                fontWeight: 400,
                color: colors.foreground,
                lineHeight: 1.1,
                margin: 0,
                letterSpacing: '-0.03em',
                fontFamily: 'Georgia, "Times New Roman", serif',
                maxWidth: '900px',
              }}
            >
              {title}
            </h1>

            {/* Description */}
            {subtitle && (
              <p
                style={{
                  fontSize: '20px',
                  color: colors.muted,
                  margin: 0,
                  lineHeight: 1.4,
                  maxWidth: '750px',
                  fontFamily: 'system-ui, sans-serif',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {subtitle}
              </p>
            )}

            {/* Stats row */}
            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginTop: '12px',
              }}
            >
              {/* Installs */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '16px 24px',
                  background: isTopOne ? `${colors.accent}15` : colors.cardBg,
                  border: `1px solid ${isTopOne ? colors.accent : colors.border}`,
                  minWidth: '120px',
                }}
              >
                <span
                  style={{
                    fontSize: '28px',
                    fontWeight: 600,
                    color: isTopOne ? colors.accent : colors.foreground,
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  {installs}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: colors.muted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginTop: '4px',
                  }}
                >
                  {t.installs}
                </span>
              </div>

              {/* Stars (for GitHub skills) */}
              {stars && stars !== '0' && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px 24px',
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    minWidth: '100px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 600,
                      color: colors.foreground,
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    {stars}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: colors.muted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginTop: '4px',
                    }}
                  >
                    ⭐ {t.stars}
                  </span>
                </div>
              )}

              {/* Rank badge */}
              {rank && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px 24px',
                    background: isTopOne ? colors.gold : colors.accent,
                    minWidth: '80px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#FFFFFF',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    #{rank}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#FFFFFF',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      marginTop: '2px',
                      opacity: 0.9,
                    }}
                  >
                    {t.rank}
                  </span>
                </div>
              )}

              {/* Author info */}
              {author && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 20px',
                    background: colors.cardBg,
                    border: `1px solid ${colors.border}`,
                    marginLeft: 'auto',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      color: colors.muted,
                    }}
                  >
                    {t.by}
                  </span>
                  <span
                    style={{
                      fontSize: '16px',
                      fontWeight: 500,
                      color: colors.foreground,
                    }}
                  >
                    {author}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '20px',
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ fontSize: '14px', color: colors.muted }}>
              skills.hot/{locale}/skills/{title.toLowerCase().replace(/\s+/g, '-')}
            </span>
            <span style={{ fontSize: '14px', color: colors.muted }}>
              {tagline}
            </span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Author page with stats
  if (type === 'author' && (skills || installs)) {
    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: isTopOne
              ? `linear-gradient(135deg, ${colors.background} 0%, ${theme === 'light' ? '#FFF8E7' : '#1a1a10'} 100%)`
              : colors.background,
            padding: '60px 80px',
            position: 'relative',
          }}
        >
          {/* Top #1 banner */}
          {isTopOne && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '6px',
                background: `linear-gradient(90deg, ${colors.gold} 0%, ${colors.accent} 50%, ${colors.gold} 100%)`,
              }}
            />
          )}

          {/* Top bar with logo */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              paddingBottom: '20px',
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>🔥</span>
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: colors.foreground,
                  letterSpacing: '-0.02em',
                }}
              >
                Skills Hot
              </span>
            </div>

            {isTopOne && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: colors.gold,
                  color: '#1A1A1A',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                🏆 {t.topContributor}
              </div>
            )}
          </div>

          {/* Double line divider */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
            <div style={{ height: '2px', background: isTopOne ? colors.gold : colors.foreground, width: '100%' }} />
            <div style={{ height: '3px', background: 'transparent' }} />
            <div style={{ height: '1px', background: isTopOne ? colors.gold : colors.foreground, width: '100%' }} />
          </div>

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              alignItems: 'center',
              gap: '48px',
              paddingTop: '40px',
              paddingBottom: '40px',
            }}
          >
            {/* Avatar */}
            {avatar && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <img
                  src={avatar}
                  width={120}
                  height={120}
                  style={{
                    borderRadius: '50%',
                    border: isTopOne ? `4px solid ${colors.gold}` : `2px solid ${colors.border}`,
                  }}
                />
                {isTopOne && (
                  <div style={{ fontSize: '32px' }}>
                    👑
                  </div>
                )}
              </div>
            )}

            {/* Author info */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                gap: '16px',
              }}
            >
              {/* Section label */}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: isTopOne ? colors.gold : colors.muted,
                }}
              >
                {isTopOne ? (`🏆 ${t.topToday}`) : getSectionLabel()}
              </span>

              {/* Name */}
              <h1
                style={{
                  fontSize: title.length > 20 ? '48px' : '56px',
                  fontWeight: 400,
                  color: colors.foreground,
                  lineHeight: 1.1,
                  margin: 0,
                  letterSpacing: '-0.03em',
                  fontFamily: 'Georgia, "Times New Roman", serif',
                }}
              >
                {title}
              </h1>

              {/* Subtitle (github login) */}
              {subtitle && (
                <p
                  style={{
                    fontSize: '18px',
                    color: colors.muted,
                    margin: 0,
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  @{subtitle}
                </p>
              )}

              {/* Stats grid */}
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '8px',
                }}
              >
                {/* Skills */}
                {skills && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '16px 24px',
                      background: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      minWidth: '120px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '28px',
                        fontWeight: 600,
                        color: colors.foreground,
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      {skills}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: colors.muted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginTop: '4px',
                      }}
                    >
                      {t.skills}
                    </span>
                  </div>
                )}

                {/* Installs */}
                {installs && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '16px 24px',
                      background: isTopOne ? `${colors.gold}15` : colors.cardBg,
                      border: `1px solid ${isTopOne ? colors.gold : colors.border}`,
                      minWidth: '120px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '28px',
                        fontWeight: 600,
                        color: isTopOne ? colors.gold : colors.foreground,
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      {installs}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: colors.muted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginTop: '4px',
                      }}
                    >
                      {t.installs}
                    </span>
                  </div>
                )}

                {/* Stars */}
                {stars && stars !== '0' && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '16px 24px',
                      background: colors.cardBg,
                      border: `1px solid ${colors.border}`,
                      minWidth: '120px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '28px',
                        fontWeight: 600,
                        color: colors.foreground,
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      {stars}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        color: colors.muted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginTop: '4px',
                      }}
                    >
                      {t.stars}
                    </span>
                  </div>
                )}

                {/* Rank badge */}
                {rank && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '16px 24px',
                      background: isTopOne ? colors.gold : colors.accent,
                      minWidth: '80px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '28px',
                        fontWeight: 700,
                        color: isTopOne ? '#1A1A1A' : '#FFFFFF',
                        fontFamily: 'Georgia, serif',
                      }}
                    >
                      #{rank}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: isTopOne ? '#1A1A1A' : '#FFFFFF',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        marginTop: '2px',
                        opacity: 0.8,
                      }}
                    >
                      {t.rank}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '20px',
              borderTop: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ fontSize: '14px', color: colors.muted }}>
              skills.hot
            </span>
            <span style={{ fontSize: '14px', color: colors.muted }}>
              {tagline}
            </span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Default/other page types
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: colors.background,
          padding: '60px 80px',
          position: 'relative',
        }}
      >
        {/* Top bar with logo */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            paddingBottom: '20px',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🔥</span>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: colors.foreground,
                letterSpacing: '-0.02em',
              }}
            >
              Skills Hot
            </span>
          </div>
          <span
            style={{
              fontSize: '14px',
              color: colors.muted,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {tagline}
          </span>
        </div>

        {/* Double line divider */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
          <div style={{ height: '2px', background: colors.foreground, width: '100%' }} />
          <div style={{ height: '3px', background: 'transparent' }} />
          <div style={{ height: '1px', background: colors.foreground, width: '100%' }} />
        </div>

        {/* Main content area */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'center',
            gap: '24px',
            paddingTop: '40px',
            paddingBottom: '40px',
          }}
        >
          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: type === 'skill' ? colors.accent : colors.muted,
              }}
            >
              {getSectionLabel()}
            </span>
            {type === 'skill' && (
              <div style={{ height: '1px', flex: 1, background: colors.border }} />
            )}
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: title.length > 30 ? '56px' : '72px',
              fontWeight: 400,
              color: colors.foreground,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: '-0.03em',
              maxWidth: '900px',
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            {title}
          </h1>

          {/* Subtitle */}
          {subtitle && (
            <p
              style={{
                fontSize: '22px',
                color: colors.muted,
                margin: 0,
                lineHeight: 1.5,
                maxWidth: '800px',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '20px',
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontSize: '14px', color: colors.muted }}>
            skills.hot
          </span>
          {type !== 'default' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: colors.accent,
                }}
              />
              <span
                style={{
                  fontSize: '12px',
                  color: colors.muted,
                  letterSpacing: '0.05em',
                }}
              >
                {type.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Corner accent for skill pages */}
        {type === 'skill' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '120px',
              height: '120px',
              background: `linear-gradient(135deg, transparent 50%, ${colors.accent}15 50%)`,
            }}
          />
        )}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
