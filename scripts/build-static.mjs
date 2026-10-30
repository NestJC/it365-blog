import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, 'src', 'content', 'blog');
const PUBLIC_DIR = path.join(ROOT, 'public');
const CSS_PATH = path.join(ROOT, 'src', 'styles', 'global.css');
const OUT_DIR = path.join(ROOT, 'docs');
const SITE_URL = 'https://it365.kr';
// Simple SHA-256 hash of editor passcode '2073' (and 'it365') validated client-side
const EDITOR_PASS_HASHES = [
  '9a25f1f8953b8c04fb7e5c3bc1a9ab0a9b23295d74b0bc224a78202f70241154', // 2073
  '8426f2021a6c27e8d8084d7a035e18f5479184567b7f2b67c72c465ffef8b8c0', // it365
];

let verifications = { google: '', naver: '', bing: '' };
const verificationPath = path.join(PUBLIC_DIR, 'site-verification.json');
if (fs.existsSync(verificationPath)) {
  try {
    verifications = { ...verifications, ...JSON.parse(fs.readFileSync(verificationPath, 'utf8')) };
  } catch {}
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function encodeBase64Utf8(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('Invalid frontmatter');
  const yamlText = match[1];
  const body = match[2];

  const data = { takeaways: [], coupangItems: [] };
  let currentKey = null;

  for (const line of yamlText.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const listMatch = line.match(/^\s*-\s+"?(.*?)"?\s*$/);
    if (listMatch && currentKey === 'takeaways') {
      data.takeaways.push(listMatch[1]);
      continue;
    }
    const kvMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let val = kvMatch[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      if (currentKey !== 'takeaways' && currentKey !== 'coupangItems') {
        data[currentKey] = val;
      }
    }
  }
  return { data, body };
}

function renderMarkdown(md) {
  const lines = md.trim().split(/\r?\n/);
  let html = '';
  let inList = false;
  let inTable = false;

  const formatInline = (text) =>
    text
      .replace(/\\\$/g, '$')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      if (inTable) {
        html += '</tbody></table>\n';
        inTable = false;
      }
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        html += '<table><thead><tr>';
        for (const c of cells) html += `<th>${formatInline(c)}</th>`;
        html += '</tr></thead><tbody>\n';
      } else {
        html += '<tr>';
        for (const c of cells) html += `<td>${formatInline(c)}</td>`;
        html += '</tr>\n';
      }
      continue;
    }

    if (inTable) {
      html += '</tbody></table>\n';
      inTable = false;
    }

    if (line.startsWith('### ')) {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      html += `<h3>${formatInline(line.slice(4))}</h3>\n`;
    } else if (line.startsWith('## ')) {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      html += `<h2>${formatInline(line.slice(3))}</h2>\n`;
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      if (!inList) {
        inList = true;
        html += '<ul>\n';
      }
      html += `<li>${formatInline(line.slice(2))}</li>\n`;
    } else {
      if (inList) {
        html += '</ul>\n';
        inList = false;
      }
      html += `<p>${formatInline(line)}</p>\n`;
    }
  }
  if (inList) html += '</ul>\n';
  if (inTable) html += '</tbody></table>\n';
  return html;
}

function renderLayout({
  title,
  description,
  lang,
  canonicalUrl,
  koAlternateUrl,
  enAlternateUrl,
  koSwitchUrl = '/ko/',
  enSwitchUrl = '/en/',
  ogType = 'website',
  robots = 'index, follow, max-image-preview:large',
  pubDate,
  bodyHtml,
}) {
  const siteName = lang === 'ko' ? 'IT365.kr — 글로벌 AI & 테크 인사이트' : 'IT365.kr — Global AI & Tech Insights';
  const fullTitle = title.includes('IT365') ? title : `${title} | IT365.kr`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ogType === 'article' ? 'TechArticle' : 'WebSite',
    headline: title,
    name: siteName,
    description,
    inLanguage: lang === 'ko' ? 'ko-KR' : 'en-US',
    datePublished: pubDate || undefined,
    url: canonicalUrl,
    publisher: {
      '@type': 'Organization',
      name: 'IT365.kr',
      url: SITE_URL,
      contactPoint: [
        {
          '@type': 'ContactPoint',
          email: 'editor@it365.kr',
          contactType: 'editorial',
        },
        {
          '@type': 'ContactPoint',
          email: 'contact@it365.kr',
          contactType: 'customer support',
        },
      ],
    },
  };

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>${fullTitle}</title>
  <meta name="description" content="${description.replace(/"/g, '&quot;')}" />
  <meta name="robots" content="${robots}" />
  ${verifications.google ? `<meta name="google-site-verification" content="${verifications.google}" />` : ''}
  ${verifications.naver ? `<meta name="naver-site-verification" content="${verifications.naver}" />` : ''}
  ${verifications.bing ? `<meta name="msvalidate.01" content="${verifications.bing}" />` : ''}
  <link rel="canonical" href="${canonicalUrl}" />
  ${koAlternateUrl ? `<link rel="alternate" hreflang="ko" href="${koAlternateUrl}" />` : ''}
  ${enAlternateUrl ? `<link rel="alternate" hreflang="en" href="${enAlternateUrl}" />` : ''}
  ${enAlternateUrl ? `<link rel="alternate" hreflang="x-default" href="${enAlternateUrl}" />` : ''}
  <link rel="alternate" type="application/rss+xml" title="${siteName}" href="${SITE_URL}/${lang}/rss.xml" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:title" content="${fullTitle.replace(/"/g, '&quot;')}" />
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
  <link rel="stylesheet" href="/assets/global.css" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a href="/${lang}/" class="brand">
        <span class="brand-badge">IT365</span>
        <span class="brand-text">${lang === 'ko' ? '테크 & AI 미디어' : 'Tech & AI Media'}</span>
      </a>
      <nav class="main-nav">
        ${
          lang === 'ko'
            ? `<a href="/ko/" class="nav-link">홈</a>
               <a href="/ko/#ai-issue" class="nav-link">일간 AI 이슈</a>
               <a href="/ko/#bigtech-weekly" class="nav-link">빅테크·루머</a>
               <a href="/ko/about/" class="nav-link">소개</a>
               <a href="/ko/contact/" class="nav-link">의견·문의</a>`
            : `<a href="/en/" class="nav-link">Home</a>
               <a href="/en/#ai-issue" class="nav-link">Daily AI News</a>
               <a href="/en/#bigtech-weekly" class="nav-link">Big Tech & Rumors</a>
               <a href="/en/about/" class="nav-link">About</a>
               <a href="/en/contact/" class="nav-link">Feedback</a>`
        }
      </nav>
      <div class="header-actions">
        <div class="lang-switcher">
          <a href="${koSwitchUrl}" class="lang-btn ${lang === 'ko' ? 'active' : ''}">🇰🇷 한국어</a>
          <a href="${enSwitchUrl}" class="lang-btn ${lang === 'en' ? 'active' : ''}">🇺🇸 EN</a>
        </div>
        <button id="theme-toggle" class="theme-btn" type="button" aria-label="다크모드 전환">🌓</button>
      </div>
    </div>
  </header>
  <main class="container">
    ${bodyHtml}
  </main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <strong>IT365.kr</strong>
        <p>${
          lang === 'ko'
            ? '글로벌 AI 모델 벤치마크, 빅테크 신제품 분석 및 실전 활용 가이드를 제공하는 한/영 다국어 테크 미디어입니다.'
            : 'Bilingual tech media covering global AI model benchmarks, Big Tech hardware analysis, and hands-on guides.'
        }</p>
      </div>
      <div class="footer-links">
        ${
          lang === 'ko'
            ? `<a href="/ko/about/">미디어 소개 (About)</a>
               <a href="/ko/privacy/">개인정보처리방침 (Privacy Policy)</a>
               <a href="/ko/contact/">의견 · 문의 보내기 (Contact)</a>
               <a href="/ko/rss.xml">RSS 피드</a>
               <a href="/en/">English Edition</a>`
            : `<a href="/en/about/">About Us</a>
               <a href="/en/privacy/">Privacy Policy</a>
               <a href="/en/contact/">Feedback & Contact</a>
               <a href="/en/rss.xml">RSS Feed</a>
               <a href="/ko/">한국어판 (Korean)</a>`
        }
      </div>
      <div class="footer-copy" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
        <span>© 2026 IT365.kr. All rights reserved.</span>
        <button type="button" id="editor-auth-btn" style="background:none; border:none; color:var(--text-muted); font-size:0.78rem; cursor:pointer; padding:0.2rem 0.4rem; opacity:0.7;">🔒 관리자</button>
      </div>
    </div>
  </footer>
  <script>
    const themeBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('it365-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    themeBtn?.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('it365-theme', next);
    });

    // Editor-only authentication & private draft rendering
    const VALID_KEYS = ['2073', 'it365', 'minung2073'];
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('editor') && VALID_KEYS.includes(urlParams.get('editor'))) {
      localStorage.setItem('it365-editor-auth', 'verified');
      window.history.replaceState({}, '', window.location.pathname);
    }

    function decodeBase64Utf8(b64) {
      const binStr = atob(b64);
      const bytes = Uint8Array.from(binStr, (m) => m.codePointAt(0));
      return new TextDecoder().decode(bytes);
    }

    function applyEditorState() {
      const isEditor = localStorage.getItem('it365-editor-auth') === 'verified';
      const authBtn = document.getElementById('editor-auth-btn');
      if (authBtn) {
        authBtn.textContent = isEditor ? '🔓 에디터 모드 (비공개 글 표시 중 · 클릭 시 로그아웃)' : '🔒 관리자';
        authBtn.style.color = isEditor ? '#2563eb' : 'var(--text-muted)';
        authBtn.style.fontWeight = isEditor ? '600' : '400';
      }

      // 1. Homepage private draft cards
      const draftContainer = document.getElementById('editor-draft-cards');
      const postSection = document.getElementById('ai-issue');
      if (draftContainer) {
        if (isEditor && draftContainer.dataset.payload) {
          draftContainer.innerHTML = decodeBase64Utf8(draftContainer.dataset.payload);
          draftContainer.style.display = 'contents';
          if (postSection) postSection.style.display = 'block';
        } else {
          draftContainer.innerHTML = '';
          draftContainer.style.display = 'none';
          if (postSection && postSection.dataset.hasPublic === 'false') {
            postSection.style.display = 'none';
          }
        }
      }

      // 2. Private draft article page
      const draftArticle = document.getElementById('editor-draft-article');
      const lockedNotice = document.getElementById('editor-locked-notice');
      if (draftArticle) {
        if (isEditor && draftArticle.dataset.payload) {
          draftArticle.innerHTML = decodeBase64Utf8(draftArticle.dataset.payload);
          draftArticle.style.display = 'block';
          if (lockedNotice) lockedNotice.style.display = 'none';
          bindActionButtons();
        } else {
          draftArticle.innerHTML = '';
          draftArticle.style.display = 'none';
          if (lockedNotice) lockedNotice.style.display = 'block';
        }
      }
    }

    function bindActionButtons() {
      document.querySelectorAll('[data-helpful-btn]').forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => btn.classList.toggle('is-active'));
      });
      document.querySelectorAll('[data-share-btn]').forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', async () => {
          const label = btn.querySelector('[data-share-label]');
          const orig = label?.textContent || '';
          try {
            await navigator.clipboard.writeText(window.location.href);
            if (label) {
              label.textContent = document.documentElement.lang === 'ko' ? '주소 복사 완료! ✓' : 'Link Copied! ✓';
              setTimeout(() => { label.textContent = orig; }, 2000);
            }
          } catch {}
        });
      });
    }

    document.getElementById('editor-auth-btn')?.addEventListener('click', () => {
      const isEditor = localStorage.getItem('it365-editor-auth') === 'verified';
      if (isEditor) {
        localStorage.removeItem('it365-editor-auth');
        applyEditorState();
      } else {
        const code = window.prompt('관리자(에디터) 암호를 입력하세요:');
        if (code && VALID_KEYS.includes(code.trim())) {
          localStorage.setItem('it365-editor-auth', 'verified');
          applyEditorState();
        } else if (code !== null) {
          window.alert('암호가 올바르지 않습니다.');
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'editor-unlock-inline-btn') {
        document.getElementById('editor-auth-btn')?.click();
      }
    });

    bindActionButtons();
    applyEditorState();
  </script>
</body>
</html>`;
}

// 1. Clean & prepare docs/
fs.rmSync(OUT_DIR, { recursive: true, force: true });
ensureDir(path.join(OUT_DIR, 'assets'));
fs.copyFileSync(CSS_PATH, path.join(OUT_DIR, 'assets', 'global.css'));
for (const file of fs.readdirSync(PUBLIC_DIR)) {
  if (file === 'site-verification.json') continue;
  fs.copyFileSync(path.join(PUBLIC_DIR, file), path.join(OUT_DIR, file));
}
fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');

// 2. Load ALL posts (both public and draft)
const allPosts = [];
for (const lang of ['ko', 'en']) {
  const dir = path.join(CONTENT_DIR, lang);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, '');
    allPosts.push({ lang, slug, data, body, isDraft: Boolean(data.draft) });
  }
}

const publicPosts = allPosts.filter((p) => !p.isDraft);
const draftPosts = allPosts.filter((p) => p.isDraft);

// 3. Build post pages (public posts normally; draft posts locked & noindex for editor only)
for (const post of allPosts) {
  const partner = allPosts.find(
    (p) => p.lang !== post.lang && p.data.translationKey === post.data.translationKey
  );
  const koSlug = post.lang === 'ko' ? post.slug : partner?.slug;
  const enSlug = post.lang === 'en' ? post.slug : partner?.slug;
  const koAlt = !post.isDraft && koSlug ? `${SITE_URL}/ko/blog/${koSlug}/` : undefined;
  const enAlt = !post.isDraft && enSlug ? `${SITE_URL}/en/blog/${enSlug}/` : undefined;
  const koSwitch = koSlug ? `/ko/blog/${koSlug}/` : '/ko/';
  const enSwitch = enSlug ? `/en/blog/${enSlug}/` : '/en/';

  const takeawaysHtml =
    post.data.takeaways?.length > 0
      ? `<aside class="takeaways-box">
          <div class="takeaways-title"><span>📌</span><strong>${
            post.lang === 'ko' ? '바쁜 독자를 위한 핵심 3줄 요약' : 'Key Takeaways at a Glance'
          }</strong></div>
          <ul class="takeaways-list">${post.data.takeaways.map((t) => `<li>${t}</li>`).join('')}</ul>
        </aside>`
      : '';

  const editorHtml = post.data.editorNote
    ? `<section class="editor-insight-box">
        <div class="editor-insight-header">
          <span class="editor-badge">💡 E-E-A-T Verified</span>
          <strong>${
            post.lang === 'ko' ? 'IT365 에디터 인사이트 & 실전 코멘트' : "IT365 Editor's Perspective"
          }</strong>
        </div>
        <p class="editor-insight-text">${post.data.editorNote}</p>
      </section>`
    : '';

  const actionBarHtml = `<div class="article-action-bar">
    <div class="action-bar-left">
      <button type="button" class="action-btn" data-helpful-btn>
        <span>👍</span>
        <span>${post.lang === 'ko' ? '이 분석이 유용했어요' : 'Helpful Analysis'}</span>
        <span class="helpful-badge">+1</span>
      </button>
      <button type="button" class="action-btn" data-share-btn>
        <span>🔗</span>
        <span data-share-label>${post.lang === 'ko' ? '링크 복사' : 'Copy Link'}</span>
      </button>
    </div>
    <div class="action-bar-right">
      <a href="/${post.lang}/contact/" class="action-btn">
        <span>✉️</span>
        <span>${post.lang === 'ko' ? '의견 · 문의 보내기' : 'Send Feedback / Inquiry'}</span>
      </a>
    </div>
  </div>`;

  const draftBanner = post.isDraft
    ? `<div style="background:#fef3c7; border:1px solid #f59e0b; color:#92400e; padding:0.75rem 1rem; border-radius:0.75rem; margin-bottom:1.25rem; font-size:0.9rem; font-weight:600;">
        🔒 비공개 초안 (관리자 로그인 상태에서만 보이며 일반 방문자 및 검색엔진에는 완전히 숨겨집니다)
      </div>`
    : '';

  const rawArticleHtml = `<article class="article-container">
    ${draftBanner}
    <header class="article-header">
      <div class="post-meta">
        <span class="badge-company">${post.data.company}</span>
        <span>•</span>
        <time datetime="${post.data.pubDate}">${post.data.pubDate.slice(0, 10)}</time>
      </div>
      <h1>${post.data.title}</h1>
    </header>
    ${takeawaysHtml}
    <div class="article-content">
      ${renderMarkdown(post.body)}
    </div>
    ${editorHtml}
    ${actionBarHtml}
  </article>`;

  const bodyHtml = post.isDraft
    ? `<div id="editor-locked-notice" class="article-container" style="text-align:center; padding:3.5rem 1.5rem;">
        <h1>🔒 비공개 아티클입니다</h1>
        <p>이 글은 현재 비공개(초안) 상태이며 관리자만 열람할 수 있습니다.</p>
        <div style="margin-top:1.5rem; display:flex; gap:0.75rem; justify-content:center;">
          <button type="button" id="editor-unlock-inline-btn" class="action-btn">🔑 관리자 로그인</button>
          <a href="/${post.lang}/" class="action-btn">홈으로 이동</a>
        </div>
      </div>
      <div id="editor-draft-article" style="display:none;" data-payload="${encodeBase64Utf8(rawArticleHtml)}"></div>`
    : rawArticleHtml;

  const pageOutDir = path.join(OUT_DIR, post.lang, 'blog', post.slug);
  ensureDir(pageOutDir);
  fs.writeFileSync(
    path.join(pageOutDir, 'index.html'),
    renderLayout({
      title: post.isDraft ? '비공개 아티클 | IT365.kr' : post.data.title,
      description: post.isDraft ? '관리자 전용 비공개 페이지입니다.' : post.data.description,
      lang: post.lang,
      canonicalUrl: `${SITE_URL}/${post.lang}/blog/${post.slug}/`,
      koAlternateUrl: koAlt,
      enAlternateUrl: enAlt,
      koSwitchUrl: koSwitch,
      enSwitchUrl: enSwitch,
      ogType: 'article',
      robots: post.isDraft ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
      pubDate: post.data.pubDate,
      bodyHtml,
    })
  );
}

// 4. Build Homepages (/ko/, /en/, /)
for (const lang of ['ko', 'en']) {
  const langPublicPosts = publicPosts.filter((p) => p.lang === lang);
  const langDraftPosts = draftPosts.filter((p) => p.lang === lang);

  const publicCardsHtml = langPublicPosts
    .map(
      (p) => `<article class="post-card">
        <div>
          <div class="post-meta">
            <span class="badge-company">${p.data.company}</span>
            <span>•</span>
            <time>${p.data.pubDate.slice(0, 10)}</time>
          </div>
          <h3><a href="/${lang}/blog/${p.slug}/">${p.data.title}</a></h3>
          <p>${p.data.description}</p>
        </div>
        <a href="/${lang}/blog/${p.slug}/">${
        lang === 'ko' ? '상세 스펙 및 분석 읽기 →' : 'Read Full Analysis →'
      }</a>
      </article>`
    )
    .join('\n');

  const draftCardsHtml = langDraftPosts
    .map(
      (p) => `<article class="post-card" style="border: 2px dashed #f59e0b; position: relative;">
        <div>
          <div class="post-meta">
            <span class="badge-company" style="background:#fef3c7; color:#92400e;">🔒 비공개 초안 (나에게만 표시)</span>
            <span>•</span>
            <span class="badge-company">${p.data.company}</span>
            <span>•</span>
            <time>${p.data.pubDate.slice(0, 10)}</time>
          </div>
          <h3><a href="/${lang}/blog/${p.slug}/">${p.data.title}</a></h3>
          <p>${p.data.description}</p>
        </div>
        <a href="/${lang}/blog/${p.slug}/">${
        lang === 'ko' ? '비공개 초안 검수하기 →' : 'Review Private Draft →'
      }</a>
      </article>`
    )
    .join('\n');

  const hasPublic = langPublicPosts.length > 0;
  const homeBody = `<section class="hero-banner">
    <h1>${
      lang === 'ko' ? '🇰🇷 IT365.kr — 글로벌 AI & 테크 인사이트' : '🇺🇸 IT365.kr — Global AI & Tech Insights'
    }</h1>
    <p>${
      lang === 'ko'
        ? '매일 아침 글로벌 AI 핵심 이슈를 기업별로 심층 분석하고, 매주 빅테크 신제품 스펙과 실전 활용기를 전달합니다.'
        : 'Data-driven analysis of frontier AI models, side-by-side spec comparisons, and weekly Big Tech hardware roundups.'
    }</p>
  </section>
  <section id="ai-issue" data-has-public="${hasPublic}" style="${hasPublic ? '' : 'display:none;'}">
    <div class="section-header">
      <h2>${lang === 'ko' ? '🔥 오늘의 글로벌 AI 이슈 (기업별 심층 분석)' : '🔥 Daily AI Model & Industry Analysis'}</h2>
    </div>
    <div class="post-grid">
      ${publicCardsHtml}
      <div id="editor-draft-cards" style="display:none;" data-payload="${encodeBase64Utf8(draftCardsHtml)}"></div>
    </div>
  </section>`;

  const langDir = path.join(OUT_DIR, lang);
  ensureDir(langDir);
  const html = renderLayout({
    title:
      lang === 'ko'
        ? 'IT365.kr 한국어판 — 글로벌 AI 핫이슈 & 빅테크 신제품 심층 분석'
        : 'IT365.kr English — Global AI Benchmarks, Pricing & Big Tech Analysis',
    description:
      lang === 'ko'
        ? '오픈AI, 구글, 앤트로픽 등 매일 업데이트되는 글로벌 AI 이슈와 삼성·애플 신제품 스펙 비교 및 실전 활용기를 확인하세요.'
        : 'In-depth daily analysis of frontier AI models (OpenAI, Google, Anthropic), API pricing comparisons, and upcoming Big Tech hardware releases.',
    lang,
    canonicalUrl: `${SITE_URL}/${lang}/`,
    koAlternateUrl: `${SITE_URL}/ko/`,
    enAlternateUrl: `${SITE_URL}/en/`,
    bodyHtml: homeBody,
  });
  fs.writeFileSync(path.join(langDir, 'index.html'), html);
  if (lang === 'ko') {
    fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
  }
}

// 5. Build About, Privacy, Contact pages + 404 + RSS + Sitemap
const staticPages = [
  {
    slug: 'about',
    koTitle: '미디어 소개 (About Us)',
    enTitle: 'About Us',
    koBody: `<article class="article-container"><h1>미디어 소개 (About IT365.kr)</h1><p><strong>IT365.kr</strong>은 급변하는 글로벌 인공지능(AI) 생태계와 빅테크 하드웨어 트렌드를 한국어(<code>/ko/</code>)와 영어(<code>/en/</code>)로 분석해 전달하는 디지털 테크 미디어입니다.</p><h2>핵심 편집 원칙</h2><ul><li><strong>데이터 기반 비교 분석:</strong> 공식 스펙·API 가격·벤치마크 수치를 표(Table)로 구조화하여 객관적인 비교 기준을 제시합니다.</li><li><strong>기업/모델별 심층 브리핑:</strong> OpenAI, Google, Anthropic, Samsung, Apple 등 주요 빅테크 발표를 개별 아티클로 다룹니다.</li><li><strong>실전 검증과 에디터 인사이트:</strong> 모든 아티클은 에디터의 직접 검토와 실사용 체감 코멘트(Editor's Perspective)를 거쳐 발행됩니다.</li></ul><h2>공식 문의처</h2><ul><li><strong>편집부 및 독자 의견:</strong> <a href="mailto:editor@it365.kr">editor@it365.kr</a></li><li><strong>비즈니스 및 제휴 문의:</strong> <a href="mailto:contact@it365.kr">contact@it365.kr</a></li></ul></article>`,
    enBody: `<article class="article-container"><h1>About IT365.kr</h1><p><strong>IT365.kr</strong> is a bilingual technology media publication covering frontier AI models, developer tools, and Big Tech hardware in both English (<code>/en/</code>) and Korean (<code>/ko/</code>).</p><h2>Our Editorial Standards</h2><ul><li><strong>Data-First Comparisons:</strong> Every article includes structured specification tables, verified API pricing, and benchmark metrics.</li><li><strong>Human-in-the-Loop Verification:</strong> Every post features an Editor's Perspective section reflecting hands-on testing and practical evaluation.</li></ul><h2>Official Contact</h2><ul><li><strong>Editorial Desk:</strong> <a href="mailto:editor@it365.kr">editor@it365.kr</a></li><li><strong>Business & Partnerships:</strong> <a href="mailto:contact@it365.kr">contact@it365.kr</a></li></ul></article>`,
  },
  {
    slug: 'privacy',
    koTitle: '개인정보처리방침 (Privacy Policy)',
    enTitle: 'Privacy Policy',
    koBody: `<article class="article-container"><h1>개인정보처리방침 (Privacy Policy)</h1><p>최종 시행일: 2026년 10월 30일</p><p><strong>IT365.kr</strong>은 방문자의 개인정보를 중요하게 생각하며 관련 법령 및 Google AdSense 정책을 준수합니다.</p><h2>1. Google AdSense 및 쿠키 고지</h2><ul><li>Google을 포함한 제3자 광고 사업자는 쿠키를 사용하여 사용자의 이전 방문 기록을 기반으로 맞춤형 광고를 게재합니다.</li><li>사용자는 언제든지 <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>에서 맞춤형 광고를 해제할 수 있습니다.</li></ul><h2>2. 제휴 마케팅 고지</h2><p>일부 한국어 기기 리뷰 글에는 쿠팡 파트너스 링크가 포함될 수 있으며 공정위 심사지침에 따른 대가성 문구를 명확히 표기합니다.</p><h2>3. 개인정보 보호 문의</h2><p>개인정보 및 정책 관련 문의는 <a href="mailto:contact@it365.kr">contact@it365.kr</a>로 연락해 주시기 바랍니다.</p></article>`,
    enBody: `<article class="article-container"><h1>Privacy Policy</h1><p>Effective Date: October 30, 2026</p><p>At <strong>IT365.kr</strong>, we respect visitor privacy and comply with Google Publisher Policies.</p><h2>Google AdSense & Cookies</h2><ul><li>Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits.</li><li>Users may opt out of personalized advertising at <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.</li></ul><h2>Privacy Inquiries</h2><p>For any privacy-related inquiries, please contact us at <a href="mailto:contact@it365.kr">contact@it365.kr</a>.</p></article>`,
  },
  {
    slug: 'contact',
    koTitle: '의견 · 문의 보내기 (Feedback & Contact)',
    enTitle: 'Feedback & Contact',
    koBody: `<article class="article-container"><h1>✉️ 의견 · 문의 보내기</h1><p><strong>IT365.kr</strong> 아티클 내용에 대한 피드백이나 질문, 앞으로 다루어주었으면 하는 AI·IT 비교 주제 제안, 또는 비즈니스·협업 문의는 아래 공식 이메일로 편하게 보내주세요.</p><div class="takeaways-box"><div class="takeaways-title"><span>📮</span><strong>IT365.kr 공식 이메일 안내</strong></div><ul class="takeaways-list"><li><strong>💬 아티클 의견 · 질문 · 주제 제안 (편집부):</strong> <a href="mailto:editor@it365.kr">editor@it365.kr</a></li><li><strong>🤝 비즈니스 · 광고 · 제휴 문의:</strong> <a href="mailto:contact@it365.kr">contact@it365.kr</a></li><li><strong>⏱️ 회신 안내:</strong> 영업일 기준 24~48시간 이내 답변</li></ul></div></article>`,
    enBody: `<article class="article-container"><h1>✉️ Feedback & Inquiries</h1><p>For article feedback, topic suggestions, or partnership inquiries regarding <strong>IT365.kr</strong>, please reach out via our official email channels:</p><div class="takeaways-box"><div class="takeaways-title"><span>📮</span><strong>Official Email Channels</strong></div><ul class="takeaways-list"><li><strong>💬 Editorial Feedback & Topic Suggestions:</strong> <a href="mailto:editor@it365.kr">editor@it365.kr</a></li><li><strong>🤝 Business & Partnerships:</strong> <a href="mailto:contact@it365.kr">contact@it365.kr</a></li><li><strong>⏱️ Response Time:</strong> Within 24–48 business hours</li></ul></div></article>`,
  },
];

for (const sp of staticPages) {
  for (const lang of ['ko', 'en']) {
    const dir = path.join(OUT_DIR, lang, sp.slug);
    ensureDir(dir);
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      renderLayout({
        title: lang === 'ko' ? sp.koTitle : sp.enTitle,
        description: lang === 'ko' ? sp.koTitle : sp.enTitle,
        lang,
        canonicalUrl: `${SITE_URL}/${lang}/${sp.slug}/`,
        koAlternateUrl: `${SITE_URL}/ko/${sp.slug}/`,
        enAlternateUrl: `${SITE_URL}/en/${sp.slug}/`,
        koSwitchUrl: `/ko/${sp.slug}/`,
        enSwitchUrl: `/en/${sp.slug}/`,
        bodyHtml: lang === 'ko' ? sp.koBody : sp.enBody,
      })
    );
  }
}

// Custom 404.html
const notFoundHtml = renderLayout({
  title: '페이지를 찾을 수 없습니다 (404 Not Found)',
  description: '요청하신 페이지가 이동되었거나 비공개 전환되었습니다.',
  lang: 'ko',
  canonicalUrl: `${SITE_URL}/404.html`,
  robots: 'noindex, follow',
  bodyHtml: `<article class="article-container" style="text-align:center; padding: 3rem 1.5rem;">
    <h1>404 — 페이지를 찾을 수 없습니다</h1>
    <p>요청하신 아티클이 비공개(초안) 상태로 전환되었거나 주소가 변경되었습니다.<br/>The requested page has been moved or set to private draft status.</p>
    <div style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
      <a href="/ko/" class="action-btn">🇰🇷 한국어 홈으로 이동 (/ko/)</a>
      <a href="/en/" class="action-btn">🇺🇸 Go to English Home (/en/)</a>
    </div>
  </article>`,
});
fs.writeFileSync(path.join(OUT_DIR, '404.html'), notFoundHtml);

// 6. Generate RSS & Sitemap (ONLY publicPosts, never draftPosts!)
for (const lang of ['ko', 'en']) {
  const langPosts = publicPosts.filter((p) => p.lang === lang);
  const rssItems = langPosts
    .map(
      (p) => `<item>
      <title><![CDATA[${p.data.title}]]></title>
      <link>${SITE_URL}/${lang}/blog/${p.slug}/</link>
      <guid>${SITE_URL}/${lang}/blog/${p.slug}/</guid>
      <pubDate>${new Date(p.data.pubDate).toUTCString()}</pubDate>
      <description><![CDATA[${p.data.description}]]></description>
    </item>`
    )
    .join('\n');
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>IT365.kr (${lang.toUpperCase()})</title>
    <link>${SITE_URL}/${lang}/</link>
    <description>IT365.kr Global AI &amp; Tech Media</description>
    <language>${lang === 'ko' ? 'ko-kr' : 'en-us'}</language>
    ${rssItems}
  </channel>
</rss>`;
  fs.writeFileSync(path.join(OUT_DIR, lang, 'rss.xml'), rssXml);
}

const todayIso = new Date().toISOString().slice(0, 10);
const urlPairs = [
  { ko: `${SITE_URL}/ko/`, en: `${SITE_URL}/en/`, lastmod: todayIso },
  ...staticPages.map((sp) => ({
    ko: `${SITE_URL}/ko/${sp.slug}/`,
    en: `${SITE_URL}/en/${sp.slug}/`,
    lastmod: todayIso,
  })),
];

for (const post of publicPosts.filter((p) => p.lang === 'ko')) {
  const partner = publicPosts.find(
    (p) => p.lang === 'en' && p.data.translationKey === post.data.translationKey
  );
  urlPairs.push({
    ko: `${SITE_URL}/ko/blog/${post.slug}/`,
    en: partner ? `${SITE_URL}/en/blog/${partner.slug}/` : undefined,
    lastmod: post.data.pubDate.slice(0, 10),
  });
}

const sitemapEntries = [];
for (const pair of urlPairs) {
  for (const loc of [pair.ko, pair.en].filter(Boolean)) {
    sitemapEntries.push(`  <url>
    <loc>${loc}</loc>
    <lastmod>${pair.lastmod}</lastmod>${
      pair.ko && pair.en
        ? `
    <xhtml:link rel="alternate" hreflang="ko" href="${pair.ko}" />
    <xhtml:link rel="alternate" hreflang="en" href="${pair.en}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${pair.en}" />`
        : ''
    }
  </url>`);
  }
}

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries.join('\n')}
</urlset>`;
fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), sitemapXml);
fs.writeFileSync(path.join(OUT_DIR, 'sitemap-index.xml'), sitemapXml);

console.log(`Built ${publicPosts.length} public posts, ${draftPosts.length} private editor-only drafts, and ${sitemapEntries.length} sitemap URLs into docs/`);
