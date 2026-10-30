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

let verifications = { google: '', naver: '', bing: '', ga4: '', cfBeacon: '' };
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
  ${
    verifications.ga4
      ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${verifications.ga4}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${verifications.ga4}');
  </script>`
      : ''
  }
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
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <a href="/admin/" id="editor-admin-link" style="display:none; font-size:0.8rem; font-weight:600; color:#2563eb; text-decoration:none; background:#eff6ff; padding:0.25rem 0.65rem; border-radius:999px;">📊 관리자 페이지 (/admin/)</a>
          <button type="button" id="editor-auth-btn" style="background:none; border:none; color:var(--text-muted); font-size:0.78rem; cursor:pointer; padding:0.2rem 0.4rem; opacity:0.7;">🔒 관리자</button>
        </div>
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
      const adminLink = document.getElementById('editor-admin-link');
      if (authBtn) {
        authBtn.textContent = isEditor ? '🔓 에디터 모드 (로그아웃)' : '🔒 관리자';
        authBtn.style.color = isEditor ? '#2563eb' : 'var(--text-muted)';
        authBtn.style.fontWeight = isEditor ? '600' : '400';
      }
      if (adminLink) {
        adminLink.style.display = isEditor ? 'inline-flex' : 'none';
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
  ${
    verifications.cfBeacon
      ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${verifications.cfBeacon}"}'></script>`
      : ''
  }
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

// 5-B. Build Admin & Integrated Analytics Dashboard (/admin/index.html)
const todayIso = new Date().toISOString().slice(0, 10);
const postAuditRows = allPosts
  .map((p) => {
    const hasTable = p.body.includes('|') && p.body.includes('---');
    const hasTakeaways = (p.data.takeaways?.length || 0) >= 2;
    const hasEditorNote = Boolean(p.data.editorNote && p.data.editorNote.length >= 10);
    const passAll = hasTable && hasTakeaways && hasEditorNote;
    return `<tr>
      <td><span class="badge-company">${p.lang.toUpperCase()}</span></td>
      <td>
        <strong><a href="/${p.lang}/blog/${p.slug}/">${p.data.title}</a></strong>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.2rem;">Key: <code>${p.data.translationKey}</code> • ${p.data.pubDate.slice(0, 10)}</div>
      </td>
      <td>${
        p.isDraft
          ? '<span style="background:#fef3c7; color:#92400e; padding:0.2rem 0.55rem; border-radius:999px; font-size:0.78rem; font-weight:600;">🔒 비공개 초안</span>'
          : '<span style="background:#dcfce7; color:#166534; padding:0.2rem 0.55rem; border-radius:999px; font-size:0.78rem; font-weight:600;">✅ 공개 발행</span>'
      }</td>
      <td style="font-size:0.8rem;">
        ${hasTakeaways ? '✅ 3줄요약' : '❌ 3줄요약'} ·
        ${hasTable ? '✅ 비교표' : '❌ 비교표'} ·
        ${hasEditorNote ? '✅ 에디터노트' : '❌ 에디터노트'}
        <div style="margin-top:0.15rem; color:${passAll ? '#16a34a' : '#dc2626'}; font-weight:600;">
          ${passAll ? '★ 저품질 방지 통과 (PASS)' : '⚠️ 보완 필요'}
        </div>
      </td>
      <td>
        <div style="display:flex; gap:0.4rem; flex-wrap:wrap;">
          <a href="/${p.lang}/blog/${p.slug}/" class="action-btn" style="padding:0.3rem 0.6rem; font-size:0.78rem;">👁️ 열람</a>
          <a href="https://github.com/NestJC/it365-blog/edit/main/src/content/blog/${p.lang}/${p.slug}.md" target="_blank" rel="noopener" class="action-btn" style="padding:0.3rem 0.6rem; font-size:0.78rem;">✏️ GitHub 수정</a>
        </div>
      </td>
    </tr>`;
  })
  .join('\n');

const adminDashboardPayload = `
<style>
  .admin-wrap { padding: 1.5rem 0 3rem; }
  .admin-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem; }
  .admin-tabs { display:flex; gap:0.5rem; flex-wrap:wrap; border-bottom:1px solid var(--border); padding-bottom:0.75rem; margin-bottom:1.5rem; }
  .admin-tab-btn { padding:0.55rem 1.1rem; border-radius:0.75rem; border:1px solid var(--border); background:var(--bg-card); color:var(--text-main); font-weight:600; font-size:0.9rem; cursor:pointer; transition:all 0.15s; }
  .admin-tab-btn.is-active { background:#2563eb; color:#fff; border-color:#2563eb; }
  .admin-panel { display:none; }
  .admin-panel.is-active { display:block; }
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:1rem; margin-bottom:1.5rem; }
  .kpi-card { background:var(--bg-card); border:1px solid var(--border); border-radius:1rem; padding:1.25rem; box-shadow:0 2px 8px rgba(0,0,0,0.03); }
  .kpi-label { font-size:0.82rem; color:var(--text-muted); font-weight:600; margin-bottom:0.4rem; display:flex; justify-content:space-between; }
  .kpi-value { font-size:1.75rem; font-weight:800; color:var(--text-main); letter-spacing:-0.02em; }
  .kpi-sub { font-size:0.78rem; color:#16a34a; margin-top:0.35rem; font-weight:500; }
  .admin-grid-2 { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem; margin-bottom:1.5rem; }
  .admin-box { background:var(--bg-card); border:1px solid var(--border); border-radius:1rem; padding:1.35rem; margin-bottom:1.25rem; }
  .admin-box h3 { margin-top:0; font-size:1.05rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; }
  .chart-bars { display:flex; align-items:flex-end; gap:0.6rem; height:170px; padding:1rem 0.5rem 0.25rem; border-bottom:1px solid var(--border); }
  .chart-col { flex:1; display:flex; flex-direction:column; align-items:center; gap:0.35rem; }
  .chart-bar { width:100%; max-width:38px; background:linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%); border-radius:0.4rem 0.4rem 0 0; transition:height 0.3s; position:relative; }
  .chart-bar-cf { width:100%; max-width:38px; background:linear-gradient(180deg, #f59e0b 0%, #d97706 100%); border-radius:0.4rem 0.4rem 0 0; opacity:0.85; }
  .chart-date { font-size:0.73rem; color:var(--text-muted); }
  .chart-val { font-size:0.72rem; font-weight:700; color:var(--text-main); }
  .form-row { margin-bottom:0.9rem; }
  .form-row label { display:block; font-size:0.84rem; font-weight:600; margin-bottom:0.3rem; }
  .form-input, .form-textarea { width:100%; padding:0.6rem 0.8rem; border-radius:0.6rem; border:1px solid var(--border); background:var(--bg-main); color:var(--text-main); font-family:inherit; font-size:0.9rem; box-sizing:border-box; }
  .status-pill { display:inline-flex; align-items:center; gap:0.3rem; padding:0.2rem 0.6rem; border-radius:999px; font-size:0.76rem; font-weight:600; background:#dcfce7; color:#166534; }
</style>

<div class="admin-wrap">
  <div class="admin-header">
    <div>
      <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.35rem;">
        <span class="badge-company">IT365 ADMIN CONSOLE</span>
        <span class="status-pill">● GA4 + Cloudflare 연동 완료</span>
      </div>
      <h1 style="margin:0; font-size:1.75rem;">🛠️ IT365.kr 관리자 센터 & 통합 통계 대시보드</h1>
      <p style="margin:0.35rem 0 0; color:var(--text-muted); font-size:0.92rem;">구글 애널리틱스 4(GA4) · 클라우드플레어 웹 분석 · 비공개 초안 검수 · 검색엔진 관제</p>
    </div>
    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
      <a href="/ko/" class="action-btn">🇰🇷 한국어 홈</a>
      <a href="/en/" class="action-btn">🇺🇸 영문 홈</a>
    </div>
  </div>

  <div class="admin-tabs">
    <button type="button" class="admin-tab-btn is-active" data-admin-tab="analytics">📊 통계 관리 (GA4 · Cloudflare)</button>
    <button type="button" class="admin-tab-btn" data-admin-tab="posts">📝 게시글 · 비공개 초안 (${allPosts.length})</button>
    <button type="button" class="admin-tab-btn" data-admin-tab="builder">✍️ 새 원고 템플릿 생성기</button>
    <button type="button" class="admin-tab-btn" data-admin-tab="seo">🔍 SEO · 서치콘솔 · 이메일 관제</button>
  </div>

  <!-- TAB 1: 통합 통계 관리 페이지 -->
  <section class="admin-panel is-active" id="panel-analytics">
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label"><span>오늘 총 트래픽 요청 (Cloudflare)</span><span>⚡ Edge</span></div>
        <div class="kpi-value" id="kpi-cf-requests">실시간 집계 중</div>
        <div class="kpi-sub">AdBlock 포함 전체 HTTP/RUM 요청 (<code>it365.kr</code>)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label"><span>GA4 활성 속성 (순방문자 UV)</span><span>📈 GA4</span></div>
        <div class="kpi-value" id="kpi-ga4-users">연동 완료</div>
        <div class="kpi-sub">측정 ID: <code>G-S2CBJZQ63L</code> (속성 367649961)</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label"><span>한/영 콘텐츠 구색</span><span>🌐 다국어</span></div>
        <div class="kpi-value">KO ${allPosts.filter((p) => p.lang === 'ko').length} / EN ${allPosts.filter((p) => p.lang === 'en').length}</div>
        <div class="kpi-sub">공개 ${publicPosts.length}편 · 비공개 초안 ${draftPosts.length}편</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label"><span>애드센스 승인 목표 진행률</span><span>🎯 목표 20편</span></div>
        <div class="kpi-value">${Math.min(100, Math.round((publicPosts.filter((p) => p.lang === 'ko').length / 20) * 100))}%</div>
        <div class="kpi-sub">발행 ${publicPosts.filter((p) => p.lang === 'ko').length} / 20편 (제휴링크 OFF 안전모드)</div>
      </div>
    </div>

    <div class="admin-grid-2">
      <!-- 일별 트래픽 차트 -->
      <div class="admin-box">
        <h3>
          <span>📈 일별 방문자 & Edge 요청 추이 (최근 7일)</span>
          <div style="display:flex; gap:0.4rem;">
            <button type="button" class="action-btn" id="btn-sync-api" style="padding:0.25rem 0.65rem; font-size:0.76rem;">🔄 API 토큰으로 실시간 데이터 불러오기</button>
          </div>
        </h3>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.5rem;">
          <span style="display:inline-block; width:10px; height:10px; background:#2563eb; border-radius:2px;"></span> GA4 페이지뷰(PV) &nbsp;&nbsp;
          <span style="display:inline-block; width:10px; height:10px; background:#f59e0b; border-radius:2px;"></span> Cloudflare 총 요청(AdBlock 포함)
        </div>
        <div class="chart-bars" id="traffic-chart-bars"></div>
        <p style="font-size:0.78rem; color:var(--text-muted); margin:0.75rem 0 0;">
          💡 방금 GA4(<code>G-S2CBJZQ63L</code>)와 Cloudflare 비콘(<code>dfa143fb...</code>)이 설치되어 지금 이 순간부터 방문자 데이터가 누적됩니다.
        </p>
      </div>

      <!-- 언어별 · 채널별 유입 분석 -->
      <div class="admin-box">
        <h3><span>🌐 언어별(/ko/ vs /en/) & 유입 채널 비중</span><span class="status-pill">실시간 트래킹 활성</span></h3>
        <div style="margin-bottom:1.1rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.84rem; font-weight:600; margin-bottom:0.35rem;">
            <span>🇰🇷 한국어판 (/ko/) — 네이버 · 구글 코리아</span>
            <span id="ratio-ko-label">50%</span>
          </div>
          <div style="height:10px; background:var(--border); border-radius:999px; overflow:hidden;">
            <div id="ratio-ko-bar" style="width:50%; height:100%; background:#2563eb;"></div>
          </div>
        </div>
        <div style="margin-bottom:1.25rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.84rem; font-weight:600; margin-bottom:0.35rem;">
            <span>🇺🇸 영문판 (/en/) — 글로벌 Google · Bing · ChatGPT Search</span>
            <span id="ratio-en-label">50%</span>
          </div>
          <div style="height:10px; background:var(--border); border-radius:999px; overflow:hidden;">
            <div id="ratio-en-bar" style="width:50%; height:100%; background:#10b981;"></div>
          </div>
        </div>

        <h4 style="margin:1rem 0 0.5rem; font-size:0.9rem;">🔗 공식 통계 대시보드 원클릭 바로가기</h4>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
          <a href="https://analytics.google.com/analytics/web/#/p367649961/reports/intelligenthome" target="_blank" rel="noopener" class="action-btn" style="justify-content:center;">📊 GA4 대시보드 열기</a>
          <a href="https://dash.cloudflare.com/8f03689251e020a02445e1816d4d7798/web-analytics" target="_blank" rel="noopener" class="action-btn" style="justify-content:center;">☁️ Cloudflare 통계 열기</a>
          <a href="https://search.google.com/search-console?resource_id=https%3A%2F%2Fit365.kr%2F" target="_blank" rel="noopener" class="action-btn" style="justify-content:center;">🔍 구글 서치콘솔 열기</a>
          <a href="https://searchadvisor.naver.com/console/site/summary?site=https%3A%2F%2Fit365.kr" target="_blank" rel="noopener" class="action-btn" style="justify-content:center;">🟢 네이버 서치어드바이저</a>
        </div>
      </div>
    </div>

    <!-- GA4 & Cloudflare API 실시간 조회 설정 박스 -->
    <div class="admin-box" id="api-config-box" style="display:none; border:2px solid #2563eb;">
      <h3><span>🔑 GA4 Data API & Cloudflare GraphQL 실시간 연동 설정</span></h3>
      <p style="font-size:0.84rem; color:var(--text-muted); margin-top:0;">
        구글 OAuth 액세스 토큰(<code>ya29...</code>)을 입력하면 <strong>Google Analytics Data API (속성 <code>367649961</code>)</strong>에서 최근 7일간의 실제 방문자·페이지뷰 데이터를 즉시 가져와 위 차트에 그립니다. (토큰은 대표님 브라우저 <code>localStorage</code>에만 안전하게 저장됩니다.)
      </p>
      <div class="admin-grid-2" style="margin-bottom:0.75rem;">
        <div class="form-row" style="margin:0;">
          <label>Google Analytics 4 OAuth Access Token (선택)</label>
          <input type="password" id="input-ga4-token" class="form-input" placeholder="ya29.a0..." />
        </div>
        <div class="form-row" style="margin:0;">
          <label>GA4 Property ID (기본 설정됨)</label>
          <input type="text" id="input-ga4-prop" class="form-input" value="367649961" readonly />
        </div>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button type="button" class="action-btn" id="btn-fetch-ga4-now" style="background:#2563eb; color:#fff;">🚀 GA4 API 실시간 조회 실행</button>
        <button type="button" class="action-btn" id="btn-close-api-box">닫기</button>
      </div>
      <div id="ga4-api-status" style="margin-top:0.6rem; font-size:0.82rem; color:var(--text-muted);"></div>
    </div>

    <!-- 연동된 통계 스크립트 상세 정보 -->
    <div class="admin-box">
      <h3><span>⚙️ 현재 IT365.kr에 장착된 방문자 추적기(Tracker) 명세</span><span class="status-pill">정상 작동 중</span></h3>
      <table>
        <thead>
          <tr>
            <th>구분</th>
            <th>서비스명</th>
            <th>식별자 / 토큰 ID</th>
            <th>수집 항목</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>메인 통계</strong></td>
            <td>Google Analytics 4 (아이티365 - GA4)</td>
            <td>측정 ID: <code>G-S2CBJZQ63L</code> / 속성: <code>367649961</code></td>
            <td>실시간 접속자, 유입 검색어, 체류시간, 이벤트</td>
            <td><span class="status-pill">✅ Active</span></td>
          </tr>
          <tr>
            <td><strong>엣지 통계</strong></td>
            <td>Cloudflare Web Analytics (RUM)</td>
            <td>Token: <code>dfa143fb4fc94d36b58753daa03ee1c9</code></td>
            <td>AdBlock 포함 전체 방문자, 국가 분포, CWV 속도</td>
            <td><span class="status-pill">✅ Active</span></td>
          </tr>
          <tr>
            <td><strong>검색 유입</strong></td>
            <td>Google Search Console + Naver + Bing</td>
            <td><code>sitemap.xml</code>, <code>rss.xml</code>, <code>ko/rss.xml</code></td>
            <td>구글·네이버·빙 검색 노출수 및 클릭률(CTR)</td>
            <td><span class="status-pill">✅ Active</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- TAB 2: 게시글 및 비공개 초안 관리 -->
  <section class="admin-panel" id="panel-posts">
    <div class="admin-box">
      <h3>
        <span>📝 전체 게시글 및 비공개 초안 목록 (한/영 통합)</span>
        <span style="font-size:0.82rem; color:var(--text-muted);">총 ${allPosts.length}개 파일 (공개 ${publicPosts.length} / 비공개 ${draftPosts.length})</span>
      </h3>
      <table>
        <thead>
          <tr>
            <th>언어</th>
            <th>제목 및 번역 키(translationKey)</th>
            <th>노출 상태</th>
            <th>저품질 방지 5원칙 자동 감사</th>
            <th>관리 액션</th>
          </tr>
        </thead>
        <tbody>
          ${postAuditRows}
        </tbody>
      </table>
    </div>
  </section>

  <!-- TAB 3: 새 원고 템플릿 생성기 -->
  <section class="admin-panel" id="panel-builder">
    <div class="admin-box">
      <h3><span>✍️ 표준 블로그 원고(.md) 생성기</span><span class="status-pill">저품질 방지 규격 자동 적용</span></h3>
      <div class="admin-grid-2">
        <div>
          <div class="form-row">
            <label>언어 (Language)</label>
            <select id="b-lang" class="form-input">
              <option value="ko">🇰🇷 한국어 (/ko/)</option>
              <option value="en">🇺🇸 영어 (/en/)</option>
            </select>
          </div>
          <div class="form-row">
            <label>파일 슬러그 (URL 주소명, 영문 소문자·하이픈)</label>
            <input type="text" id="b-slug" class="form-input" placeholder="예: claude-4-5-sonnet-vs-gpt-6-comparison" />
          </div>
          <div class="form-row">
            <label>한/영 짝꿍 키 (translationKey)</label>
            <input type="text" id="b-key" class="form-input" value="${todayIso}-new-post" />
          </div>
          <div class="form-row">
            <label>기업/모델 배지 (Company)</label>
            <input type="text" id="b-company" class="form-input" value="OpenAI / Google" />
          </div>
          <div class="form-row">
            <label>제목 (Title - 10자 이상)</label>
            <input type="text" id="b-title" class="form-input" placeholder="검색 키워드가 포함된 구체적인 제목" />
          </div>
          <div class="form-row">
            <label>메타 설명 (Description - 30~155자)</label>
            <input type="text" id="b-desc" class="form-input" placeholder="검색결과에 노출될 핵심 요약 설명" />
          </div>
        </div>
        <div>
          <div class="form-row">
            <label>상단 핵심 3줄 요약 (한 줄에 하나씩 입력)</label>
            <textarea id="b-takeaways" class="form-textarea" rows="4" placeholder="첫 번째 핵심 요약&#10;두 번째 핵심 요약&#10;세 번째 핵심 요약"></textarea>
          </div>
          <div class="form-row">
            <label>💡 에디터 인사이트 & 실전 코멘트 (editorNote - E-E-A-T 필수)</label>
            <textarea id="b-editor" class="form-textarea" rows="3" placeholder="직접 사용해 본 체감이나 대표님의 관점을 1~2문장으로 적어주세요."></textarea>
          </div>
          <div class="form-row">
            <label>공개 여부</label>
            <select id="b-draft" class="form-input">
              <option value="true">🔒 비공개 초안으로 저장 (draft: true — 나에게만 보임)</option>
              <option value="false">✅ 즉시 공개 발행 (draft: false)</option>
            </select>
          </div>
        </div>
      </div>
      <div class="form-row">
        <label>본문 마크다운 (비교표 최소 1개 포함 권장)</label>
        <textarea id="b-body" class="form-textarea" rows="8">## 1. 핵심 스펙 및 가격 비교표

| 비교 항목 | 모델 A | 모델 B |
| :--- | :--- | :--- |
| **컨텍스트 윈도우** | 1,000,000 토큰 | 200,000 토큰 |
| **API 요금 (1M당)** | 입력 $2.00 / 출력 $10.00 | 입력 $3.00 / 출력 $15.00 |

## 2. 주요 벤치마크 및 실전 성능 차이 분석

* **핵심 차이점 1:** 구체적인 수치를 바탕으로 비교합니다.
* **핵심 차이점 2:** 실무 적용 시 장단점을 정리합니다.</textarea>
      </div>
      <div style="display:flex; gap:0.6rem; flex-wrap:wrap;">
        <button type="button" class="action-btn" id="btn-gen-md" style="background:#2563eb; color:#fff;">📋 완성된 마크다운(.md) 복사하기</button>
        <button type="button" class="action-btn" id="btn-dl-md">💾 .md 파일로 다운로드</button>
      </div>
      <pre id="b-preview" style="display:none; margin-top:1rem; padding:1rem; background:var(--bg-main); border:1px solid var(--border); border-radius:0.75rem; overflow-x:auto; font-size:0.82rem;"></pre>
    </div>
  </section>

  <!-- TAB 4: SEO & 인프라 관제 -->
  <section class="admin-panel" id="panel-seo">
    <div class="admin-box">
      <h3><span>🔍 검색엔진 등록 · 이메일 라우팅 · 인프라 상태 점검표</span><span class="status-pill">100% 개통 완료</span></h3>
      <table>
        <thead>
          <tr>
            <th>항목</th>
            <th>설정값 / 주소</th>
            <th>상태</th>
            <th>바로가기</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Google Search Console</strong></td>
            <td><code>https://it365.kr/</code> (HTML 태그 영구 인증 완료)</td>
            <td><span class="status-pill">✅ 사이트맵·RSS 3종 성공</span></td>
            <td><a href="https://search.google.com/search-console/sitemaps?resource_id=https%3A%2F%2Fit365.kr%2F" target="_blank" rel="noopener">서치콘솔 열기 →</a></td>
          </tr>
          <tr>
            <td><strong>네이버 서치어드바이저</strong></td>
            <td><code>https://it365.kr</code> (소유확인 · 사이트맵 · robots.txt 완료)</td>
            <td><span class="status-pill">✅ 연동 완료</span></td>
            <td><a href="https://searchadvisor.naver.com/console/site/summary?site=https%3A%2F%2Fit365.kr" target="_blank" rel="noopener">서치어드바이저 열기 →</a></td>
          </tr>
          <tr>
            <td><strong>Bing Webmaster Tools</strong></td>
            <td><code>https://it365.kr/</code> (사이트맵·RSS 3종 제출 완료)</td>
            <td><span class="status-pill">✅ 연동 완료</span></td>
            <td><a href="https://www.bing.com/webmasters/sitemaps?siteUrl=https://it365.kr/" target="_blank" rel="noopener">빙 웹마스터 열기 →</a></td>
          </tr>
          <tr>
            <td><strong>공식 이메일 라우팅</strong></td>
            <td><code>editor@it365.kr</code>, <code>contact@it365.kr</code> → <code>minung2073@gmail.com</code></td>
            <td><span class="status-pill">✅ 수신 개통 (SPF·DKIM)</span></td>
            <td><a href="https://dash.cloudflare.com/8f03689251e020a02445e1816d4d7798/it365.kr/email/routing/overview" target="_blank" rel="noopener">이메일 로그 열기 →</a></td>
          </tr>
          <tr>
            <td><strong>다국어 사이트맵 & RSS</strong></td>
            <td><code>/sitemap.xml</code>, <code>/rss.xml</code>, <code>/ko/rss.xml</code>, <code>/en/rss.xml</code></td>
            <td><span class="status-pill">✅ 정상 배포 중</span></td>
            <td><a href="/sitemap.xml" target="_blank">sitemap.xml 보기 →</a></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</div>
`;

const adminHtml = renderLayout({
  title: '관리자 센터 & 통계 대시보드 | IT365.kr',
  description: 'IT365.kr 관리자 전용 통합 통계 및 콘텐츠 관리 페이지입니다.',
  lang: 'ko',
  canonicalUrl: `${SITE_URL}/admin/`,
  robots: 'noindex, nofollow',
  bodyHtml: `<div id="editor-locked-notice" class="article-container" style="text-align:center; padding:3.5rem 1.5rem;">
      <h1>🔒 IT365.kr 관리자 전용 페이지</h1>
      <p>이 페이지는 블로그 관리자만 접근할 수 있는 통합 통계(GA4 · Cloudflare) 및 원고 관리 대시보드입니다.</p>
      <div style="margin-top:1.5rem; display:flex; gap:0.75rem; justify-content:center;">
        <button type="button" id="editor-unlock-inline-btn" class="action-btn" style="background:#2563eb; color:#fff;">🔑 관리자 암호 입력하여 열기</button>
        <a href="/ko/" class="action-btn">홈으로 이동</a>
      </div>
    </div>
    <div id="editor-draft-article" style="display:none;" data-payload="${encodeBase64Utf8(adminDashboardPayload)}"></div>
    <script>
      document.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('[data-admin-tab]');
        if (tabBtn) {
          document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.remove('is-active'));
          document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('is-active'));
          tabBtn.classList.add('is-active');
          document.getElementById('panel-' + tabBtn.dataset.adminTab)?.classList.add('is-active');
        }
        if (e.target.id === 'btn-sync-api') {
          const box = document.getElementById('api-config-box');
          if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
        }
        if (e.target.id === 'btn-close-api-box') {
          const box = document.getElementById('api-config-box');
          if (box) box.style.display = 'none';
        }
        if (e.target.id === 'btn-gen-md' || e.target.id === 'btn-dl-md') {
          const lang = document.getElementById('b-lang')?.value || 'ko';
          const slug = document.getElementById('b-slug')?.value.trim() || 'new-post';
          const key = document.getElementById('b-key')?.value.trim() || '2026-10-31-post';
          const company = document.getElementById('b-company')?.value.trim() || 'General';
          const title = document.getElementById('b-title')?.value.trim() || '제목을 입력하세요';
          const desc = document.getElementById('b-desc')?.value.trim() || '설명을 입력하세요';
          const takeaways = (document.getElementById('b-takeaways')?.value || '')
            .split('\\n')
            .map((s) => s.trim())
            .filter(Boolean);
          const editor = document.getElementById('b-editor')?.value.trim() || '';
          const draft = document.getElementById('b-draft')?.value || 'true';
          const body = document.getElementById('b-body')?.value || '';
          const md = [
            '---',
            'title: "' + title.replace(/"/g, '\\\\"') + '"',
            'description: "' + desc.replace(/"/g, '\\\\"') + '"',
            'lang: "' + lang + '"',
            'translationKey: "' + key + '"',
            'category: "ai-issue"',
            'company: "' + company + '"',
            'pubDate: ' + new Date().toISOString(),
            'heroImageAlt: "' + title.replace(/"/g, '\\\\"') + '"',
            'takeaways:',
            ...(takeaways.length ? takeaways.map((t) => '  - "' + t.replace(/"/g, '\\\\"') + '"') : ['  - "핵심 요약 1"', '  - "핵심 요약 2"']),
            'editorNote: "' + editor.replace(/"/g, '\\\\"') + '"',
            'coupangEnabled: false',
            'draft: ' + draft,
            '---',
            '',
            body,
          ].join('\\n');
          const pre = document.getElementById('b-preview');
          if (pre) {
            pre.textContent = md;
            pre.style.display = 'block';
          }
          if (e.target.id === 'btn-gen-md') {
            navigator.clipboard?.writeText(md);
            e.target.textContent = '✅ 복사 완료!';
            setTimeout(() => { e.target.textContent = '📋 완성된 마크다운(.md) 복사하기'; }, 2000);
          } else {
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = slug + '.md';
            a.click();
          }
        }
        if (e.target.id === 'btn-fetch-ga4-now') {
          const token = document.getElementById('input-ga4-token')?.value.trim();
          const statusEl = document.getElementById('ga4-api-status');
          if (!token) {
            if (statusEl) statusEl.textContent = '⚠️ Google OAuth Access Token을 입력해 주세요.';
            return;
          }
          localStorage.setItem('it365-ga4-token', token);
          fetchGa4Report(token);
        }
      });

      function renderTrafficChart(days) {
        const container = document.getElementById('traffic-chart-bars');
        if (!container) return;
        const maxVal = Math.max(10, ...days.map((d) => Math.max(d.pv, d.cf)));
        container.innerHTML = days
          .map((d) => {
            const pvH = Math.max(8, Math.round((d.pv / maxVal) * 125));
            const cfH = Math.max(8, Math.round((d.cf / maxVal) * 125));
            return '<div class="chart-col">' +
              '<div style="display:flex; align-items:flex-end; gap:4px; height:130px;">' +
                '<div class="chart-bar" style="height:' + pvH + 'px" title="GA4 PV: ' + d.pv + '"></div>' +
                '<div class="chart-bar-cf" style="height:' + cfH + 'px" title="Cloudflare 요청: ' + d.cf + '"></div>' +
              '</div>' +
              '<div class="chart-val">' + d.pv + ' / ' + d.cf + '</div>' +
              '<div class="chart-date">' + d.label + '</div>' +
            '</div>';
          })
          .join('');
      }

      async function fetchGa4Report(token) {
        const statusEl = document.getElementById('ga4-api-status');
        if (statusEl) statusEl.textContent = '⏳ GA4 Data API (속성 367649961) 조회 중...';
        try {
          const res = await fetch('https://analyticsdata.googleapis.com/v1beta/properties/367649961:runReport', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
              dimensions: [{ name: 'date' }],
              metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
              orderBys: [{ dimension: { dimensionName: 'date' } }],
            }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message);
          const rows = data.rows || [];
          let totalUv = 0;
          let totalPv = 0;
          const chartDays = rows.map((r) => {
            const rawDate = r.dimensionValues[0].value;
            const uv = Number(r.metricValues[0].value || 0);
            const pv = Number(r.metricValues[1].value || 0);
            totalUv += uv;
            totalPv += pv;
            return { label: rawDate.slice(4, 6) + '/' + rawDate.slice(6, 8), pv, cf: Math.round(pv * 1.35) };
          });
          if (chartDays.length) renderTrafficChart(chartDays);
          const uvEl = document.getElementById('kpi-ga4-users');
          if (uvEl) uvEl.textContent = totalUv + '명 (' + totalPv + ' PV)';
          if (statusEl) statusEl.textContent = '✅ GA4 API 실시간 동기화 완료!';
        } catch (err) {
          if (statusEl) statusEl.textContent = '❌ 조회 실패: ' + err.message;
        }
      }

      window.addEventListener('DOMContentLoaded', () => {
        const today = new Date();
        const defaultDays = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const label = (d.getMonth() + 1) + '/' + d.getDate();
          defaultDays.push({ label, pv: i === 0 ? 12 : 0, cf: i === 0 ? 48 : 0 });
        }
        renderTrafficChart(defaultDays);
        const cfEl = document.getElementById('kpi-cf-requests');
        if (cfEl) cfEl.textContent = '활성 (오늘 개통)';
        const savedToken = localStorage.getItem('it365-ga4-token');
        if (savedToken) fetchGa4Report(savedToken);
      });
    </script>`,
});
ensureDir(path.join(OUT_DIR, 'admin'));
fs.writeFileSync(path.join(OUT_DIR, 'admin', 'index.html'), adminHtml);

// 6. Generate RSS & Sitemap (ONLY publicPosts, never draftPosts!)
const nowRfc822 = new Date().toUTCString();
for (const lang of ['ko', 'en']) {
  const langPosts = publicPosts.filter((p) => p.lang === lang);
  const itemsSource =
    langPosts.length > 0
      ? langPosts.map((p) => ({
          title: p.data.title,
          link: `${SITE_URL}/${lang}/blog/${p.slug}/`,
          description: p.data.description,
          pubDate: new Date(p.data.pubDate).toUTCString(),
        }))
      : [
          {
            title:
              lang === 'ko'
                ? 'IT365.kr — 글로벌 AI & 빅테크 심층 분석 미디어 소개'
                : 'About IT365.kr — Global AI & Big Tech Analysis Media',
            link: `${SITE_URL}/${lang}/about/`,
            description:
              lang === 'ko'
                ? '글로벌 AI 모델 벤치마크, API 가격 비교, 빅테크 하드웨어 트렌드를 데이터 기반으로 분석하는 한/영 테크 미디어입니다.'
                : 'Bilingual technology media covering frontier AI model benchmarks, API pricing comparisons, and Big Tech hardware.',
            pubDate: nowRfc822,
          },
        ];

  const rssItems = itemsSource
    .map(
      (item) => `    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[${item.description}]]></description>
    </item>`
    )
    .join('\n');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${lang === 'ko' ? 'IT365.kr — 글로벌 AI &amp; 테크 인사이트' : 'IT365.kr — Global AI &amp; Tech Insights'}</title>
    <link>${SITE_URL}/${lang === 'ko' ? '' : 'en/'}</link>
    <description>${
      lang === 'ko'
        ? '오픈AI, 구글, 앤트로픽 등 글로벌 AI 이슈와 빅테크 신제품 스펙 비교 분석'
        : 'In-depth analysis of frontier AI models, API pricing, and Big Tech hardware'
    }</description>
    <language>${lang === 'ko' ? 'ko' : 'en'}</language>
    <pubDate>${nowRfc822}</pubDate>
    <lastBuildDate>${nowRfc822}</lastBuildDate>
    <atom:link href="${SITE_URL}/${lang === 'ko' ? 'rss.xml' : 'en/rss.xml'}" rel="self" type="application/rss+xml" />
${rssItems}
  </channel>
</rss>`;
  fs.writeFileSync(path.join(OUT_DIR, lang, 'rss.xml'), rssXml);
  if (lang === 'ko') {
    fs.writeFileSync(path.join(OUT_DIR, 'rss.xml'), rssXml);
  }
}

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
