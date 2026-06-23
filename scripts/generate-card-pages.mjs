/**
 * Generate static HTML pages for Major Arcana tarot card interpretations.
 *
 * Produces:
 *   - {outputDir}/cards/index.html       — major arcana listing page
 *   - {outputDir}/cards/{id}-{slug}.html — individual card pages (22)
 *
 * All pages use the existing design system (css/style.css) and are
 * SEO-optimized with meta tags, Open Graph, and Schema.org JSON-LD.
 *
 * Path references use absolute root paths (e.g. /static/css/style.css).
 * The build-gh-pages.mjs rewrite step converts them to the GitHub Pages
 * base path (/taronyang/...) during the build.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MAJOR_ARCANA, MINOR_ARCANA, ALL_CARDS, getNextCard, getPrevCard } from './card-data.mjs';

const __scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__scriptDir, '..');
const SITE_URL = 'https://taronyang.com';

function slugify(card) {
  return `${card.id}-${card.slug}`;
}

function cardUrl(card) {
  return `/cards/${slugify(card)}.html`;
}

function cardFullUrl(card) {
  return `${SITE_URL}/cards/${slugify(card)}.html`;
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

function generateCardPage(card, allCards) {
  const prev = getPrevCard(card.id);
  const next = getNextCard(card.id);
  const title = `${card.name} (${card.nameEn}) 타로카드 의미와 해석 | 타로냥`;
  const description = `${card.name}(${card.nameEn}) 카드의 정방향·역방향 의미, 연애운·재물운·직장운 해석. ${card.meaningUp}`;
  const keywordsStr = [...card.keywordsUp, ...card.keywordsDown, card.name, card.nameEn, '타로카드', card.id < 22 ? '메이저아르카나' : '마이너아르카나', '타로해석'].join(', ');

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${card.name} (${card.nameEn}) 타로카드 의미와 해석`,
    description: card.meaningUp,
    url: cardFullUrl(card),
    image: `${SITE_URL}/og-image.png`,
    author: { '@type': 'Organization', name: '타로냥' },
    publisher: {
      '@type': 'Organization',
      name: '타로냥',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.png` },
    },
    datePublished: '2026-06-20',
    dateModified: '2026-06-24',
    inLanguage: 'ko-KR',
    about: {
      '@type': 'Thing',
      name: `${card.name} (${card.nameEn})`,
      description: card.meaningUp,
    },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: card.id < 22 ? '메이저 아르카나' : '마이너 아르카나', item: `${SITE_URL}/cards/` },
      { '@type': 'ListItem', position: 3, name: card.name, item: cardFullUrl(card) },
    ],
  };

  const keywordTags = (arr, type) =>
    arr.map((k) => `<span class="keyword-tag ${type}">${escapeHtml(k)}</span>`).join('\n                    ');

  const relatedCards = [5, 11, 7, 17].map(
    (offset) => allCards[(card.id + offset) % allCards.length],
  );

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="keywords" content="${escapeHtml(keywordsStr)}">
    <meta property="og:title" content="${escapeHtml(card.name)} (${escapeHtml(card.nameEn)}) 타로카드 | 타로냥">
    <meta property="og:description" content="${escapeHtml(card.meaningUp)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${cardFullUrl(card)}">
    <meta property="og:site_name" content="타로냥">
    <meta property="og:image" content="${SITE_URL}/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="ko_KR">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(card.name)} (${escapeHtml(card.nameEn)}) 타로카드 | 타로냥">
    <meta name="twitter:description" content="${escapeHtml(card.meaningUp)}">
    <meta name="twitter:image" content="${SITE_URL}/og-image.png">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${cardFullUrl(card)}">
    <script type="application/ld+json">
    ${JSON.stringify(schemaData, null, 2)}
    </script>
    <script type="application/ld+json">
    ${JSON.stringify(breadcrumb, null, 2)}
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
    <link rel="preload" href="/static/css/style.css" as="style">
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
            <a href="/cards/" class="header-login">카드 목록</a>
        </header>

        <article class="card-detail">
            <nav class="breadcrumb" aria-label="breadcrumb">
                <a href="/">홈</a>
                <span aria-hidden="true">›</span>
                <a href="/cards/">${card.id < 22 ? '메이저 아르카나' : '마이너 아르카나'}</a>
                <span aria-hidden="true">›</span>
                <span class="breadcrumb-current">${escapeHtml(card.name)}</span>
            </nav>

            <div class="card-detail-hero">
                <div class="card-detail-number">No. ${card.id}</div>
                <div class="card-detail-symbol" aria-hidden="true">${card.symbol}</div>
                <h1 class="card-detail-name">${escapeHtml(card.name)}</h1>
                <p class="card-detail-name-en">${escapeHtml(card.nameEn)}</p>
                <div class="card-detail-meta">
                    <span class="meta-tag">🔷 원소: ${escapeHtml(card.element)}</span>
                    <span class="meta-tag">🪐 연관 행성: ${escapeHtml(card.planet)}</span>
                </div>
            </div>

            <section class="card-section">
                <h2 class="card-section-title">✨ 정방향 (바른 위치)</h2>
                <div class="card-meaning positive">
                    <p class="card-meaning-text">${escapeHtml(card.meaningUp)}</p>
                </div>
                <div class="card-keywords">
                    <span class="keywords-label">긍정적 키워드:</span>
                    <div class="keyword-list">
                    ${keywordTags(card.keywordsUp, 'up')}
                    </div>
                </div>
            </section>

            <section class="card-section">
                <h2 class="card-section-title">🔄 역방향 (거꾸로)</h2>
                <div class="card-meaning negative">
                    <p class="card-meaning-text">${escapeHtml(card.meaningDown)}</p>
                </div>
                <div class="card-keywords">
                    <span class="keywords-label">부정적 키워드:</span>
                    <div class="keyword-list">
                    ${keywordTags(card.keywordsDown, 'down')}
                    </div>
                </div>
            </section>

            <section class="card-section">
                <h2 class="card-section-title">💬 분야별 조언</h2>
                <div class="advice-grid">
                    <div class="advice-card">
                        <div class="advice-icon" aria-hidden="true">💕</div>
                        <div class="advice-title">연애운</div>
                        <p class="advice-text">${escapeHtml(card.loveAdvice)}</p>
                    </div>
                    <div class="advice-card">
                        <div class="advice-icon" aria-hidden="true">💼</div>
                        <div class="advice-title">직장운</div>
                        <p class="advice-text">${escapeHtml(card.careerAdvice)}</p>
                    </div>
                    <div class="advice-card">
                        <div class="advice-icon" aria-hidden="true">💰</div>
                        <div class="advice-title">재물운</div>
                        <p class="advice-text">${escapeHtml(card.moneyAdvice)}</p>
                    </div>
                </div>
            </section>

            <section class="card-cta">
                <a href="/tarot" class="cta-button">이 카드로 타로 보기 →</a>
            </section>

            <nav class="card-nav" aria-label="카드 탐색">
                <a href="${cardUrl(prev)}" class="card-nav-btn prev" rel="prev">
                    <span class="card-nav-arrow" aria-hidden="true">←</span>
                    <span class="card-nav-info">
                        <span class="card-nav-label">이전 카드</span>
                        <span class="card-nav-name">${escapeHtml(prev.name)}</span>
                    </span>
                </a>
                <a href="${cardUrl(next)}" class="card-nav-btn next" rel="next">
                    <span class="card-nav-info">
                        <span class="card-nav-label">다음 카드</span>
                        <span class="card-nav-name">${escapeHtml(next.name)}</span>
                    </span>
                    <span class="card-nav-arrow" aria-hidden="true">→</span>
                </a>
            </nav>

            <section class="card-section">
                <h2 class="card-section-title">🔗 관련 카드</h2>
                <div class="related-cards">
                    ${relatedCards.map((c) => `
                    <a href="${cardUrl(c)}" class="related-card">
                        <span class="related-card-symbol" aria-hidden="true">${c.symbol}</span>
                        <span class="related-card-name">${escapeHtml(c.name)}</span>
                        <span class="related-card-number">No. ${c.id}</span>
                    </a>`).join('')}
                </div>
            </section>

            <section class="share-section" data-share data-share-url="${cardFullUrl(card)}" data-share-title="${escapeHtml(card.name)} (${escapeHtml(card.nameEn)}) 타로카드 | 타로냥" data-share-desc="${escapeHtml(card.meaningUp)}"></section>
        </article>

        <footer class="footer">
            <p><a href="/cards/">메이저 아르카나 전체 보기</a> · <a href="/">타로냥 홈</a></p>
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

function generateIndexPage(cards) {
  const title = '타로카드 78장 의미 총정리 (메이저+마이너 아르카나) | 타로냥';
  const description = '타로 메이저 아르카나 22장 + 마이너 아르카나 56장의 정방향·역방향 의미, 연애운·재물운·직장운 해석을 한 곳에서. 무료 AI 타로 타로냥.';

  const majorCards = cards.filter((c) => c.id < 22);
  const minorCards = cards.filter((c) => c.id >= 22);
  const suitGroups = {
    컵: { title: '💕 컵 (Cups)', cards: minorCards.filter((c) => c.name.startsWith('컵')) },
    펜타클: { title: '💰 펜타클 (Pentacles)', cards: minorCards.filter((c) => c.name.startsWith('펜타클')) },
    소드: { title: '⚔️ 소드 (Swords)', cards: minorCards.filter((c) => c.name.startsWith('소드')) },
    완드: { title: '🔥 완드 (Wands)', cards: minorCards.filter((c) => c.name.startsWith('완드')) },
  };

  const cardItemHtml = (card) => `
                <a href="${cardUrl(card)}" class="card-index-item">
                    <div class="card-index-number">No. ${card.id}</div>
                    <div class="card-index-symbol" aria-hidden="true">${card.symbol}</div>
                    <div class="card-index-name">${escapeHtml(card.name)}</div>
                    <div class="card-index-name-en">${escapeHtml(card.nameEn)}</div>
                </a>`;

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '타로카드 78장 의미 총정리',
    description: '타로 메이저 아르카나 22장 + 마이너 아르카나 56장의 카드별 의미와 해석 모음.',
    url: `${SITE_URL}/cards/`,
    inLanguage: 'ko-KR',
    isPartOf: { '@type': 'WebSite', name: '타로냥', url: SITE_URL },
  };

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="keywords" content="타로카드 의미, 메이저 아르카나, 마이너 아르카나, 타로 해석, 78장 타로, 컵, 펜타클, 소드, 완드, 타로냥">
    <meta property="og:title" content="타로카드 78장 의미 총정리 | 타로냥">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${SITE_URL}/cards/">
    <meta property="og:site_name" content="타로냥">
    <meta property="og:image" content="${SITE_URL}/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="ko_KR">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="타로카드 78장 의미 총정리 | 타로냥">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${SITE_URL}/og-image.png">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${SITE_URL}/cards/">
    <script type="application/ld+json">
    ${JSON.stringify(schemaData, null, 2)}
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
    <link rel="preload" href="/static/css/style.css" as="style">
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
            <a href="/tarot" class="header-login">타로 보기</a>
        </header>

        <section class="hero">
            <div class="hero-icon" aria-hidden="true">🃏</div>
            <h1 class="hero-title">타로카드 의미 총정리</h1>
            <p class="hero-subtitle">메이저 아르카나 22장 + 마이너 아르카나 56장</p>
        </section>

        <section class="section">
            <p class="section-title">🃏 메이저 아르카나 (22장)</p>
            <div class="card-index-grid">
                ${majorCards.map(cardItemHtml).join('')}
            </div>
        </section>

        ${Object.values(suitGroups).map((group) => `
        <section class="section">
            <p class="section-title">${group.title} (${group.cards.length}장)</p>
            <div class="card-index-grid">
                ${group.cards.map(cardItemHtml).join('')}
            </div>
        </section>`).join('')}

        <section class="card-cta">
            <a href="/tarot" class="cta-button">지금 타로 보기 →</a>
        </section>

        <section class="share-section" data-share data-share-url="${SITE_URL}/cards/" data-share-title="타로카드 78장 의미 총정리 | 타로냥" data-share-desc="메이저 아르카나 22장 + 마이너 아르카나 56장의 카드별 의미와 해석 모음."></section>

        <footer class="footer">
            <p>타로냥 © 2026</p>
            <p><a href="/">홈으로</a> · <a href="/tarot">타로 보기</a></p>
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

export function generateCardPages(outputDir) {
  const cardsDir = join(outputDir, 'cards');
  mkdirSync(cardsDir, { recursive: true });

  console.log('[card-pages] Generating card pages...');
  for (const card of ALL_CARDS) {
    const html = generateCardPage(card, ALL_CARDS);
    const filePath = join(cardsDir, `${slugify(card)}.html`);
    writeFileSync(filePath, html);
    console.log(`  ✓ cards/${card.id}-${card.slug}.html`);
  }

  const indexHtml = generateIndexPage(ALL_CARDS);
  writeFileSync(join(cardsDir, 'index.html'), indexHtml);
  console.log('  ✓ cards/index.html');

  console.log(`[card-pages] ✅ Generated ${ALL_CARDS.length} card pages + index`);
}

// Allow direct execution: node scripts/generate-card-pages.mjs [outputDir]
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outputDir = process.argv[2] || join(ROOT, 'gh-pages-build');
  generateCardPages(outputDir);
}
