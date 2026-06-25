/**
 * Daily Fortune Auto-Publishing System (ZEMA-2666)
 *
 * Generates a deterministic daily tarot fortune blog post for the given date.
 * The same date always produces the same 3 cards and the same fortune text,
 * so it is safe to run in CI without an LLM API key.
 *
 * Outputs (under frontend/blog/daily/):
 *   - {YYYY-MM-DD}.html       — individual daily fortune page (SEO-optimized)
 *   - index.html              — listing of the most recent 30 daily fortunes
 *   - today-meta.json         — today's fortune metadata for homepage preview
 *
 * Usage:
 *   node scripts/generate-daily-fortune.mjs [YYYY-MM-DD] [--days N]
 *
 *   --days N  Generate N days of fortune ending today (backfill). Default: 1.
 *
 * The generated pages use the existing design system (/static/css/style.css)
 * with absolute root paths that build-gh-pages.mjs rewrites to the GitHub
 * Pages base path during the build.
 */

import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MAJOR_ARCANA } from './card-data.mjs';

const __scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__scriptDir, '..');
const DAILY_DIR = join(ROOT, 'frontend', 'blog', 'daily');
const SITEMAP_PATH = join(ROOT, 'frontend', 'sitemap.xml');
const SITE_URL = process.env.SITE_URL || 'https://zemyalpha.github.io/taronyang';

// ── Deterministic PRNG ────────────────────────────────────────────

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateToSeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = Math.imul(31, hash) + dateStr.charCodeAt(i) | 0;
  }
  return hash;
}

// ── Card selection ─────────────────────────────────────────────────

const SPREAD_POSITIONS = [
  { key: 'energy', label: '오늘의 에너지', emoji: '☀️' },
  { key: 'caution', label: '주의할 점', emoji: '⚠️' },
  { key: 'advice', label: '오늘의 조언', emoji: '💡' },
];

function pickCardsForDate(dateStr) {
  const rng = mulberry32(dateToSeed(dateStr));
  const pool = [...MAJOR_ARCANA];
  const picked = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.map((card, i) => ({
    ...card,
    position: SPREAD_POSITIONS[i],
    reversed: rng() > 0.65,
  }));
}

// ── Lucky elements ─────────────────────────────────────────────────

const LUCKY_COLORS = [
  { name: '라벤더 퍼플', hex: '#a78bfa' },
  { name: '골드', hex: '#fbbf24' },
  { name: '소프트 그린', hex: '#86efac' },
  { name: '코랄 핑크', hex: '#fb7185' },
  { name: '스카이 블루', hex: '#38bdf8' },
  { name: '선셋 오렌지', hex: '#fb923c' },
  { name: '딥 네이비', hex: '#6366f1' },
  { name: '로즈 골드', hex: '#f472b6' },
  { name: '민트', hex: '#34d399' },
];

function luckyColor(dateStr) {
  const rng = mulberry32(dateToSeed(dateStr + 'color'));
  return LUCKY_COLORS[Math.floor(rng() * LUCKY_COLORS.length)];
}

function luckyNumber(dateStr) {
  const rng = mulberry32(dateToSeed(dateStr + 'number'));
  return Math.floor(rng() * 9) + 1;
}

// ── Fortune text generation ───────────────────────────────────────

function getParticle(word, particle) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasBatchim = code >= 0 && code % 28 !== 0;
  if (particle === '과') return hasBatchim ? '과' : '와';
  if (particle === '이') return hasBatchim ? '이' : '가';
  return particle;
}

function overallSummary(cards) {
  const [energy, caution, advice] = cards;
  const energyWord = energy.keywordsUp[0];
  const adviceWord = advice.keywordsUp[0];
  const cautionWord = caution.reversed ? caution.keywordsDown[0] : caution.keywordsUp[0];
  return `오늘은 「${energyWord}」의 에너지가 흐르는 날이에요. ${energy.meaningUp} 다만 「${cautionWord}」${getParticle(cautionWord, '과')} 관련된 부분은 조심하고, ${advice.name}${getParticle(advice.name, '이')} 주는 「${adviceWord}」의 메시지를 하루의 나침반으로 삼아보세요.`;
}

function loveReading(cards) {
  const card = cards[0].reversed ? cards[2] : cards[0];
  return card.loveAdvice;
}

function careerReading(cards) {
  const card = cards[2].reversed ? cards[0] : cards[2];
  return card.careerAdvice;
}

function moneyReading(cards) {
  const card = cards[1];
  return card.moneyAdvice;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Date helpers ───────────────────────────────────────────────────

function todayKST() {
  // KST is UTC+9. Shift to get the correct KST calendar date.
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

function formatDateKorean(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

function getWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return days[date.getUTCDay()];
}

function subtractDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - n);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// ── Card URL helper ────────────────────────────────────────────────

function cardSlug(card) {
  return `${card.id}-${card.slug}`;
}

function cardUrl(card) {
  return `/cards/${cardSlug(card)}.html`;
}

function cardFullUrl(card) {
  return `${SITE_URL}/cards/${cardSlug(card)}.html`;
}

// ── Daily fortune HTML page ────────────────────────────────────────

function generateDailyPage(dateStr, cards) {
  const weekday = getWeekday(dateStr);
  const dateKr = formatDateKorean(dateStr);
  const summary = overallSummary(cards);
  const color = luckyColor(dateStr);
  const number = luckyNumber(dateStr);
  const title = `${dateKr} ${weekday} 오늘의 타로운세 — ${cards.map(c => c.name).join('·')} | 타로냥`;
  const description = `${dateKr} ${weekday} 오늘의 타로운세. ${cards.map(c => c.name).join(', ')} 카드로 보는 연애운, 재물운, 직장운과 오늘의 행운의 색. 매일 업데이트되는 무료 타로운세.`;
  const keywords = `오늘의운세, ${dateKr} 운세, 타로운세, 일운, 일일운세, 매일운세, ${cards.map(c => c.name).join(', ')}, 무료운세, AI타로`;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${dateKr} ${weekday} 오늘의 타로운세`,
    description: summary,
    url: `${SITE_URL}/blog/daily/${dateStr}.html`,
    image: `${SITE_URL}/og-image.png`,
    author: { '@type': 'Organization', name: '타로냥' },
    publisher: {
      '@type': 'Organization',
      name: '타로냥',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.png` },
    },
    datePublished: dateStr,
    dateModified: dateStr,
    inLanguage: 'ko-KR',
    about: {
      '@type': 'Thing',
      name: `${dateKr} 오늘의 타로운세`,
      description: summary,
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: '블로그', item: `${SITE_URL}/blog/` },
      { '@type': 'ListItem', position: 3, name: '오늘의 운세', item: `${SITE_URL}/blog/daily/` },
      { '@type': 'ListItem', position: 4, name: dateKr, item: `${SITE_URL}/blog/daily/${dateStr}.html` },
    ],
  };

  const cardSectionHtml = (card) => {
    const meaning = card.reversed ? card.meaningDown : card.meaningUp;
    const keywords = card.reversed ? card.keywordsDown : card.keywordsUp;
    const orientation = card.reversed ? '역방향 (거꾸로)' : '정방향 (바른 위치)';
    const orientationClass = card.reversed ? 'negative' : 'positive';
    return `
            <div class="daily-card-reading ${orientationClass}">
                <div class="daily-card-header">
                    <span class="daily-card-position">${card.position.emoji} ${card.position.label}</span>
                    <span class="daily-card-orientation">${orientation}</span>
                </div>
                <a href="${cardUrl(card)}" class="daily-card-link">
                    <span class="daily-card-symbol" aria-hidden="true">${card.symbol}</span>
                    <span class="daily-card-name">${escapeHtml(card.name)} <span class="daily-card-name-en">(${escapeHtml(card.nameEn)})</span></span>
                </a>
                <p class="daily-card-meaning">${escapeHtml(meaning)}</p>
                <div class="daily-card-keywords">
                    ${keywords.map(k => `<span class="keyword-tag ${card.reversed ? 'down' : 'up'}">${escapeHtml(k)}</span>`).join('')}
                </div>
            </div>`;
  };

  const prevDate = subtractDays(dateStr, 1);
  const nextDate = subtractDays(dateStr, -1);
  const prevExists = existsSync(join(DAILY_DIR, `${prevDate}.html`));
  const nextExists = existsSync(join(DAILY_DIR, `${nextDate}.html`));

  const navHtml = `
            <nav class="card-nav" aria-label="일운 탐색">
                ${prevExists ? `<a href="/blog/daily/${prevDate}.html" class="card-nav-btn prev" rel="prev">
                    <span class="card-nav-arrow" aria-hidden="true">←</span>
                    <span class="card-nav-info">
                        <span class="card-nav-label">어제의 운세</span>
                        <span class="card-nav-name">${formatDateKorean(prevDate)}</span>
                    </span>
                </a>` : '<span class="card-nav-btn prev disabled"></span>'}
                ${nextExists ? `<a href="/blog/daily/${nextDate}.html" class="card-nav-btn next" rel="next">
                    <span class="card-nav-info">
                        <span class="card-nav-label">내일의 운세</span>
                        <span class="card-nav-name">${formatDateKorean(nextDate)}</span>
                    </span>
                    <span class="card-nav-arrow" aria-hidden="true">→</span>
                </a>` : '<span class="card-nav-btn next disabled"></span>'}
            </nav>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="keywords" content="${escapeHtml(keywords)}">
    <meta property="og:title" content="${dateKr} ${weekday} 오늘의 타로운세 | 타로냥">
    <meta property="og:description" content="${escapeHtml(summary)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${SITE_URL}/blog/daily/${dateStr}.html">
    <meta property="og:site_name" content="타로냥">
    <meta property="og:image" content="${SITE_URL}/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="ko_KR">
    <meta property="article:published_time" content="${dateStr}T07:00:00+09:00">
    <meta property="article:author" content="타로냥">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${dateKr} ${weekday} 오늘의 타로운세 | 타로냥">
    <meta name="twitter:description" content="${escapeHtml(summary)}">
    <meta name="twitter:image" content="${SITE_URL}/og-image.png">
    <meta name="robots" content="index, follow">
    <meta name="author" content="타로냥">
    <link rel="canonical" href="${SITE_URL}/blog/daily/${dateStr}.html">
    <script type="application/ld+json">
    ${JSON.stringify(articleSchema, null, 2)}
    </script>
    <script type="application/ld+json">
    ${JSON.stringify(breadcrumbSchema, null, 2)}
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/css/style.css">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#0a0a2e">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png">
    <noscript>
        <style>.stars .star { animation: none; opacity: 0.5; }</style>
    </noscript>
</head>
<body>
    <a href="#main-content" class="skip-nav">본문으로 건너뛰기</a>
    <div class="stars" id="stars"></div>

    <div class="container" id="main-content">
        <header class="header">
            <a href="/" class="header-logo">🔮 타로냥</a>
            <a href="/blog/daily/" class="header-login">일운 목록</a>
        </header>

        <article>
            <nav class="breadcrumb" aria-label="breadcrumb">
                <a href="/">홈</a>
                <span aria-hidden="true">›</span>
                <a href="/blog/">블로그</a>
                <span aria-hidden="true">›</span>
                <a href="/blog/daily/">오늘의 운세</a>
                <span aria-hidden="true">›</span>
                <span class="breadcrumb-current">${dateKr} ${weekday}</span>
            </nav>

            <div class="blog-hero">
                <div class="blog-hero-emoji" aria-hidden="true">🌅</div>
                <h1 class="blog-hero-title">${dateKr} ${weekday} 오늘의 타로운세</h1>
                <p class="blog-hero-meta">타로냥 · ${dateStr} · 행운의 색 <span style="color:${color.hex};font-weight:700;">${color.name}</span> · 행운의 숫자 ${number}</p>
            </div>

            <div class="blog-article">
                <section>
                    <p>${escapeHtml(summary)}</p>
                    <p>오늘 뽑힌 세 카드는 <a href="${cardUrl(cards[0])}">${escapeHtml(cards[0].name)}</a> · <a href="${cardUrl(cards[1])}">${escapeHtml(cards[1].name)}</a> · <a href="${cardUrl(cards[2])}">${escapeHtml(cards[2].name)}</a>예요. 각 카드가 전하는 메시지를 아래에서 자세히 읽어보세요.</p>
                </section>

                <section>
                    <h2>🃏 오늘의 3카드 스프레드</h2>
                    ${cards.map(cardSectionHtml).join('\n')}
                </section>

                <section>
                    <h2>💕 오늘의 연애운</h2>
                    <p>${escapeHtml(loveReading(cards))}</p>
                </section>

                <section>
                    <h2>💼 오늘의 직장운</h2>
                    <p>${escapeHtml(careerReading(cards))}</p>
                </section>

                <section>
                    <h2>💰 오늘의 재물운</h2>
                    <p>${escapeHtml(moneyReading(cards))}</p>
                </section>

                <section>
                    <h2>🍀 오늘의 행운</h2>
                    <div class="advice-grid">
                        <div class="advice-card">
                            <div class="advice-icon" aria-hidden="true">🎨</div>
                            <div class="advice-title">행운의 색</div>
                            <p class="advice-text"><span style="color:${color.hex};font-weight:700;">${color.name}</span></p>
                        </div>
                        <div class="advice-card">
                            <div class="advice-icon" aria-hidden="true">🔢</div>
                            <div class="advice-title">행운의 숫자</div>
                            <p class="advice-text">${number}</p>
                        </div>
                        <div class="advice-card">
                            <div class="advice-icon" aria-hidden="true">${cards[2].symbol}</div>
                            <div class="advice-title">오늘의 키워드</div>
                            <p class="advice-text">${escapeHtml(cards[2].reversed ? cards[2].keywordsDown[0] : cards[2].keywordsUp[0])}</p>
                        </div>
                    </div>
                </section>

                <section>
                    <h2>📖 카드 의미 더 알아보기</h2>
                    <p>오늘 나온 카드의 더 자세한 의미가 궁금하다면 아래 링크에서 확인해보세요.</p>
                    <div class="related-cards">
                        ${cards.map(c => `
                        <a href="${cardUrl(c)}" class="related-card">
                            <span class="related-card-symbol" aria-hidden="true">${c.symbol}</span>
                            <span class="related-card-name">${escapeHtml(c.name)}</span>
                            <span class="related-card-number">No. ${c.id}</span>
                        </a>`).join('')}
                    </div>
                </section>

                <section>
                    <h2>🗓️ 이번 주 다른 날 운세</h2>
                    <ul>
                        <li><a href="/blog/daily/">최근 일운 전체 보기</a></li>
                        <li><a href="/daily">오늘의 운세 인터랙티브 페이지 →</a></li>
                    </ul>
                </section>
            </div>

            ${navHtml}

            <section class="card-cta">
                <a href="/tarot" class="cta-button">오늘의 카드로 타로 상담받기 →</a>
            </section>
        </article>

        <footer class="footer">
            <p><a href="/blog/daily/">일운 목록</a> · <a href="/blog/">블로그</a> · <a href="/cards/">타로카드 의미</a> · <a href="/">타로냥 홈</a></p>
            <p style="margin-top:8px;font-size:11px;">이 서비스는 오락 목적이며, 전문적인 조언을 대체하지 않습니다.</p>
        </footer>
    </div>

    <script>
        (function() {
            const starsEl = document.getElementById('stars');
            if (starsEl) {
                for (let i = 0; i < 30; i++) {
                    const star = document.createElement('div');
                    star.className = 'star';
                    star.style.left = Math.random() * 100 + '%';
                    star.style.top = Math.random() * 100 + '%';
                    star.style.animationDuration = (2 + Math.random() * 3) + 's';
                    star.style.animationDelay = Math.random() * 3 + 's';
                    starsEl.appendChild(star);
                }
            }
        })();
    </script>
    <script src="/static/js/share.js"></script>
</body>
</html>`;
}

// ── Daily index page ───────────────────────────────────────────────

function scanExistingFortunes() {
  if (!existsSync(DAILY_DIR)) return [];
  return readdirSync(DAILY_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
    .map((f) => f.replace('.html', ''))
    .sort()
    .reverse();
}

function generateDailyIndex(fortuneDates) {
  const recent = fortuneDates.slice(0, 30);
  const title = '오늘의 타로운세 — 매일 업데이트되는 일운 타로 | 타로냥';
  const description = '매일 아침 업데이트되는 오늘의 타로운세. 3장의 타로 카드로 보는 연애운, 재물운, 직장운과 행운의 색·숫자. 최근 30일치 일운을 한눈에 보세요.';

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '오늘의 타로운세 — 일운 아카이브',
    description: '매일 업데이트되는 오늘의 타로운세 모음.',
    url: `${SITE_URL}/blog/daily/`,
    inLanguage: 'ko-KR',
    isPartOf: { '@type': 'WebSite', name: '타로냥', url: SITE_URL },
  };

  const itemHtml = (dateStr) => {
    const cards = pickCardsForDate(dateStr);
    const weekday = getWeekday(dateStr);
    const summary = overallSummary(cards);
    return `
                <a href="/blog/daily/${dateStr}.html" class="daily-index-item">
                    <div class="daily-index-date">${formatDateKorean(dateStr)} ${weekday}</div>
                    <div class="daily-index-cards">${cards.map(c => `<span class="daily-index-card-symbol" aria-hidden="true">${c.symbol}</span>`).join('')}</div>
                    <div class="daily-index-summary">${escapeHtml(summary.length > 80 ? summary.slice(0, 78) + '…' : summary)}</div>
                </a>`;
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="keywords" content="오늘의운세, 일운, 타로운세, 매일운세, 일일운세, 오늘의타로, 무료운세, 타로냥">
    <meta property="og:title" content="오늘의 타로운세 — 일운 아카이브 | 타로냥">
    <meta property="og:description" content="매일 업데이트되는 오늘의 타로운세. 최근 30일치 일운을 한눈에 보세요.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SITE_URL}/blog/daily/">
    <meta property="og:site_name" content="타로냥">
    <meta property="og:image" content="${SITE_URL}/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="ko_KR">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="오늘의 타로운세 — 일운 아카이브 | 타로냥">
    <meta name="twitter:description" content="매일 업데이트되는 오늘의 타로운세.">
    <meta name="twitter:image" content="${SITE_URL}/og-image.png">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${SITE_URL}/blog/daily/">
    <script type="application/ld+json">
    ${JSON.stringify(schemaData, null, 2)}
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/css/style.css">
    <link rel="manifest" href="/manifest.json">
    <meta name="theme-color" content="#0a0a2e">
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png">
    <noscript>
        <style>.stars .star { animation: none; opacity: 0.5; }</style>
    </noscript>
</head>
<body>
    <a href="#main-content" class="skip-nav">본문으로 건너뛰기</a>
    <div class="stars" id="stars"></div>

    <div class="container" id="main-content">
        <header class="header">
            <a href="/" class="header-logo">🔮 타로냥</a>
            <a href="/blog/" class="header-login">블로그</a>
        </header>

        <section class="hero">
            <div class="hero-icon" aria-hidden="true">🌅</div>
            <h1 class="hero-title">오늘의 타로운세</h1>
            <p class="hero-subtitle">매일 아침 새로운 일운이 업데이트돼요</p>
        </section>

        <section class="section">
            <p class="section-title">🗓️ 최근 일운</p>
            <div class="daily-index-list">
${recent.map(itemHtml).join('\n')}
            </div>
        </section>

        <section class="card-cta">
            <a href="/daily" class="cta-button">오늘의 운세 바로 보기 →</a>
        </section>

        <footer class="footer">
            <p><a href="/blog/">블로그</a> · <a href="/cards/">타로카드 의미</a> · <a href="/">타로냥 홈</a></p>
            <p style="margin-top:8px;font-size:11px;">이 서비스는 오락 목적이며, 전문적인 조언을 대체하지 않습니다.</p>
        </footer>
    </div>

    <script>
        (function() {
            const starsEl = document.getElementById('stars');
            if (starsEl) {
                for (let i = 0; i < 30; i++) {
                    const star = document.createElement('div');
                    star.className = 'star';
                    star.style.left = Math.random() * 100 + '%';
                    star.style.top = Math.random() * 100 + '%';
                    star.style.animationDuration = (2 + Math.random() * 3) + 's';
                    star.style.animationDelay = Math.random() * 3 + 's';
                    starsEl.appendChild(star);
                }
            }
        })();
    </script>
    <script src="/static/js/share.js"></script>
</body>
</html>`;
}

// ── Today metadata (for homepage preview) ──────────────────────────

function generateTodayMeta(dateStr, cards) {
  const summary = overallSummary(cards);
  return {
    date: dateStr,
    weekday: getWeekday(dateStr),
    cards: cards.map(c => ({
      name: c.name,
      symbol: c.symbol,
      slug: cardSlug(c),
    })),
    summary: summary.length > 100 ? summary.slice(0, 97) + '…' : summary,
    luckyColor: luckyColor(dateStr).name,
    luckyColorHex: luckyColor(dateStr).hex,
    luckyNumber: luckyNumber(dateStr),
    url: `/blog/daily/${dateStr}.html`,
  };
}

// ── Sitemap auto-update (ZEMA-2676) ────────────────────────────────

function updateSitemapWithDailyFortunes(fortuneDates) {
  if (!existsSync(SITEMAP_PATH)) {
    console.log('  ⚠ sitemap.xml not found — skipping sitemap update');
    return;
  }

  let sitemap = readFileSync(SITEMAP_PATH, 'utf-8');

  // Remove any previously injected daily fortune block (idempotent).
  // `\r?\n` matches both LF and CRLF line endings for cross-platform safety.
  // `[ \t]*` tolerates variable indentation so the block is found even if the
  // file is reformatted (e.g. by Prettier with 4-space or zero indent).
  // `[ \t]*` after the end marker tolerates trailing horizontal whitespace
  // that a formatter or manual edit might leave before the newline.
  // Matching the optional trailing newline `(\r?\n)?` removes the blank line
  // left before </urlset> in a single pass, so no separate cleanup step is
  // needed and the file's original line-ending style is preserved
  // (ZEMA-2678 idempotency fix).
  sitemap = sitemap.replace(/\r?\n[ \t]*<!-- daily-fortune-start -->[\s\S]*?<!-- daily-fortune-end -->[ \t]*(\r?\n)?/g, '');

  const today = todayKST();

  const indexUrl = [
    `  <url>`,
    `    <loc>${SITE_URL}/blog/daily/</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>daily</changefreq>`,
    `    <priority>0.9</priority>`,
    `  </url>`,
  ].join('\n');

  const fortuneUrls = fortuneDates.map((dateStr) => [
    `  <url>`,
    `    <loc>${SITE_URL}/blog/daily/${dateStr}.html</loc>`,
    `    <lastmod>${dateStr}</lastmod>`,
    `    <changefreq>monthly</changefreq>`,
    `    <priority>0.8</priority>`,
  `  </url>`,
  ].join('\n')).join('\n');

  const injection = `\n  <!-- daily-fortune-start -->\n${indexUrl}\n${fortuneUrls}\n  <!-- daily-fortune-end -->`;
  sitemap = sitemap.replace('</urlset>', `${injection}\n</urlset>`);
  writeFileSync(SITEMAP_PATH, sitemap);
  console.log(`  ✓ sitemap.xml updated with ${fortuneDates.length} daily fortune URLs`);
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  mkdirSync(DAILY_DIR, { recursive: true });

  // Parse arguments
  const args = process.argv.slice(2);
  let targetDate = todayKST();
  let days = 1;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days') {
      days = parseInt(args[i + 1], 10) || 1;
      i++;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(args[i])) {
      targetDate = args[i];
    }
  }

  const dates = [];
  for (let i = 0; i < days; i++) {
    dates.push(subtractDays(targetDate, i));
  }

  console.log('[daily-fortune] Generating daily fortunes...');
  for (const dateStr of dates) {
    const cards = pickCardsForDate(dateStr);
    const html = generateDailyPage(dateStr, cards);
    writeFileSync(join(DAILY_DIR, `${dateStr}.html`), html);
    console.log(`  ✓ ${dateStr} — ${cards.map(c => c.name).join(' · ')}`);
  }

  // Regenerate index with all existing fortunes
  const allFortunes = scanExistingFortunes();
  const indexHtml = generateDailyIndex(allFortunes);
  writeFileSync(join(DAILY_DIR, 'index.html'), indexHtml);
  console.log(`  ✓ index.html (${allFortunes.length} fortunes listed)`);

  // Auto-update sitemap.xml with all daily fortune URLs (ZEMA-2676)
  updateSitemapWithDailyFortunes(allFortunes);

  // Generate today-meta.json for homepage preview
  const todayCards = pickCardsForDate(targetDate);
  const meta = generateTodayMeta(targetDate, todayCards);
  writeFileSync(join(DAILY_DIR, 'today-meta.json'), JSON.stringify(meta, null, 2));
  console.log(`  ✓ today-meta.json (${targetDate})`);

  console.log(`[daily-fortune] ✅ Done! Generated ${dates.length} fortune(s).`);
}

main();
