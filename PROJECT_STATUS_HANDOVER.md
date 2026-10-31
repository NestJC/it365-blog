# IT365.kr 프로젝트 전체 진행상황 및 코덱스(Codex) 인수인계 가이드

> **작성 일시:** 2026-10-31 (KST)  
> **프로젝트 명:** IT365.kr (글로벌 AI & 빅테크 테크 미디어 블로그)  
> **공식 도메인:** `https://it365.kr` (한국어판 `/ko/`, 영문판 `/en/`)  
> **GitHub 저장소:** `https://github.com/NestJC/it365-blog` (공개 저장소, 브랜치: `main`, 배포 폴더: `/docs`)  
> **호스팅 & CDN:** GitHub Pages (SSL 강제 활성화) + Cloudflare (DNS Only / Proxy OFF) + Gabia (도메인 등록처)

---

## 1. 프로젝트 핵심 원칙 및 비즈니스 룰 (Must Follow)

1. **소통 및 타깃 언어:**
   - 관리자/사용자 소통 언어: **100% 한국어**.
   - 블로그 서비스 구조: 단일 도메인 다국어 (`https://it365.kr/ko/`, `https://it365.kr/en/`), `hreflang` 상호 참조 및 Self-Referencing Canonical 적용.
2. **구글 저품질(Scaled Content Abuse) 방지 5원칙:**
   - **무검수 자동 발행 금지:** 모든 글은 초안(`draft: true`)으로 작성 후 관리자의 직접 검수 및 경험/의견 코멘트(`editorNote`)가 반영되어야 발행(`draft: false`).
   - **상투적 AI 문구 영구 금지:** *"최근 ~가 화제입니다"*, *"이번 글에서는 ~에 대해 알아보겠습니다"* 등 진부한 도입부 절대 금지. 첫 문장부터 핵심 팩트/결론 제시.
   - **구조화 필수:** 상단 **핵심 3줄 요약 박스(`takeaways`)** + 본문 내 구체적 수치 기반 **마크다운 비교표(`<table>`) 최소 1개** 필수 포함.
   - **문체:** 한국어는 `~합니다 / ~입니다` 체 기본 + 요약/비교 구간 개조식 혼용. 영문은 직역 금지 및 영미권 검색 키워드 기반 현지화.
3. **수익화 규칙 (80:20 법칙):**
   - 구글 애드센스 승인 전(초기 15~20편): 모든 제휴 링크 `OFF` (`coupangEnabled: false`).
   - 승인 후: AI 정보성 글(80%)은 링크 제외, 기기 리뷰/루머 글(20%)에만 선택적 `ON` 및 공정위 대가성 문구 표기 (`/en/` 영문 페이지는 쿠팡 영구 제외).

---

## 2. 인프라 및 검색엔진/이메일 세팅 완료 현황 (100% 완료)

| 영역 | 설정 내역 | 상태 | 세부 정보 및 키값 |
| :--- | :--- | :---: | :--- |
| **가비아 (Gabia)** | 네임서버 변경 완료 | ✅ 완료 | 1차: `athena.ns.cloudflare.com`<br>2차: `miguel.ns.cloudflare.com` |
| **클라우드플레어 (Cloudflare)** | DNS & 도메인 활성화 | ✅ Active | Zone ID: `1a799c5d46db4dd429f093e5fb3fb0d7`<br>GitHub Pages IP A 레코드 4개 + CNAME `www` (DNS Only / 회색 구름) |
| **이메일 라우팅 (Email Routing)** | 공식 이메일 개통 (수신 포워딩) | ✅ Ready | `editor@it365.kr` → `minung2073@gmail.com`<br>`contact@it365.kr` → `minung2073@gmail.com`<br>`*@it365.kr` (Catch-all) → `minung2073@gmail.com`<br>MX 레코드 3개 + SPF/DKIM TXT 정상 잠금 |
| **Google Search Console** | 사이트 등록 및 영구 인증 | ✅ 완료 | 메타태그: `<meta name="google-site-verification" content="jlyYCbTkZRCUTyuFEjh_Hu929gkp8rgysiHGPJQyuxw" />`<br>제출 사이트맵: `/sitemap.xml`, `/ko/rss.xml`, `/en/rss.xml` (모두 '성공') |
| **네이버 서치어드바이저** | 소유확인 및 사이트맵/RSS | ✅ 완료 | 메타태그: `<meta name="naver-site-verification" content="f2925d57d728ecc09a8d3c3b908c25c4912218aa" />`<br>인증파일: `naverc2f5357c34105f4eed8fd370565d1746.html`<br>사이트맵: `https://it365.kr/sitemap.xml`<br>RSS: `https://it365.kr/rss.xml` (등록일 26.10.31 08:31:17) |
| **Bing Webmaster Tools** | 사이트 등록 및 피드 제출 | ✅ 완료 | `sitemap.xml`, `ko/rss.xml`, `en/rss.xml` 3종 제출 완료 (오류 0건) |
| **Google Analytics 4 (GA4)** | 방문자 트래킹 스크립트 | ✅ Active | 계정: `125797091`, 속성: `367649961` (`아이티365 - GA4`)<br>측정 ID: **`G-S2CBJZQ63L`** (전체 페이지 장착) |
| **Cloudflare Web Analytics** | RUM 엣지 방문자 통계 | ✅ Active | Site Token: **`dfa143fb4fc94d36b58753daa03ee1c9`**<br>Ruleset ID: `a2e0d602-a3a7-44bf-bbdd-6435eb442ea6` |

---

## 3. 코드베이스 아키텍처 및 핵심 파일 구조

GitHub Pages 배포 특성상 Node.js 의존성 충돌을 방지하기 위해 **단일 제로-디펜던시 빌더 스크립트(`scripts/build-static.mjs`)**를 통해 마크다운 원고를 파싱하여 `docs/` 정적 HTML로 컴파일 후 배포하는 고속 구조를 채택하고 있습니다.

```text
it365-blog/
├── .gemini/rules/it365-blog-rules.md   # 블로그 운영 상세 규칙
├── BLOG_CHECKLIST_AND_RULES.md         # 블로그 마스터 체크리스트
├── GEMINI.md                           # AI 에이전트 필수 준수 규칙
├── package.json                        # Astro 5.x 프로젝트 설정
├── astro.config.mjs                    # Astro 환경 설정
├── scripts/
│   ├── build-static.mjs               # 핵심 빌드 컴파일러 (Markdown -> docs/ HTML 변환, RSS/Sitemap/관리자 대시보드 생성)
│   └── check-dns.ps1                  # DNS 점검용 파워쉘 스크립트
├── public/
│   ├── site-verification.json         # 서치콘솔/네이버/GA4 토큰 모음
│   ├── naverc2f5357c34105f4eed8fd370565d1746.html # 네이버 인증 파일
│   ├── robots.txt                     # 검색엔진 허용 및 사이트맵 명시
│   └── favicon.svg                    # 공식 파비콘
├── src/
│   ├── content/
│   │   ├── config.ts                  # Zod 콘텐츠 스키마 (title, takeaways, editorNote, coupang 등)
│   │   └── blog/
│   │       ├── ko/                    # 한국어 마크다운 원고 (.md)
│   │       └── en/                    # 영문 마크다운 원고 (.md)
│   ├── components/                    # Astro 컴포넌트들 (SEOHead, Header, Footer 등)
│   └── styles/
│       └── global.css                 # 토스 테크 스타일 카드 UI 및 다크모드 CSS
├── drafts/
│   ├── TEMPLATE_KO.md                 # 한국어 블로그 글 작성 표준 서식 템플릿
│   └── TEMPLATE_EN.md                 # 영문 블로그 글 작성 표준 서식 템플릿
└── docs/                              # GitHub Pages 실제 서비스 배포 폴더 (git push 시 자동 반영)
    ├── CNAME                          # it365.kr
    ├── index.html                     # 루트 홈 (/ko/로 리다이렉트 및 한국어 메인)
    ├── 404.html                       # 티스토리 과거 색인 대응 커스텀 404 페이지
    ├── admin/index.html               # 관리자 센터 & 통합 통계 대시보드
    ├── sitemap.xml                    # xhtml:link 다국어 지원 사이트맵
    ├── rss.xml                        # 루트 RSS 피드
    ├── ko/                            # 한국어판 홈 및 아티클
    └── en/                            # 영문판 홈 및 아티클
```

---

## 4. 현재 구현된 주요 기능

### 1) 비공개 글(`draft: true`) 완전 차단 및 관리자 전용 열람 모드
* `draft: true`인 글은 `docs/` 정적 파일 빌드 시 본문이 Base64로 인코딩 잠금 처리되며, `sitemap.xml`과 RSS에서 100% 제외됩니다.
* 일반 방문자에게는 아티클 목록 카드가 노출되지 않으며, URL로 직접 접근해도 **"🔒 비공개 아티클입니다"** 잠금 화면만 뜹니다.
* 관리자가 사이트 하단 푸터 우측의 **`🔒 관리자`** 버튼을 눌러 암호(`2073` 또는 `it365`)를 입력하거나 `?editor=2073` 파라미터로 접속하면 브라우저 `localStorage`에 인증이 저장되어 **오직 관리자 화면에서만 노란색 점선 카드로 비공개 초안이 노출되고 본문이 복호화**됩니다.

### 2) 관리자 센터 & 통합 통계 대시보드 (`/admin/`)
* **접속 주소:** `https://it365.kr/admin/?editor=2073`
* **탭 1: 통계 관리 (GA4 · Cloudflare):**
  * 4대 KPI 요약 카드 (Cloudflare 총 요청, GA4 순방문자, 한/영 비율, 애드센스 달성률)
  * 일별 듀얼 트래픽 차트 (GA4 PV vs Cloudflare RUM 요청)
  * GA4 Data API (`속성 367649961`) OAuth 토큰 실시간 조회 기능 내장
* **탭 2: 게시글 · 초안 관리:** 전체 원고의 **저품질 방지 5원칙(3줄 요약, 비교표, 에디터노트) 자동 감사(`★ PASS` 배지)** 및 `[GitHub에서 바로 수정]` 링크 제공.
* **탭 3: 새 원고 템플릿 생성기:** 웹 폼 입력 시 오타 없는 Frontmatter 마크다운 생성 및 복사/다운로드.
* **탭 4: SEO 관제:** 서치콘솔, 네이버, 빙, 클라우드플레어 이메일 바로가기 허브.

---

## 5. 코덱스(Codex)에서 이어서 진행해야 할 핵심 작업 (Next Steps)

대표님께서 코덱스에서 높은 추론 능력으로 틀과 기초를 잡으실 핵심 작업 4가지입니다:

### Task 1: 관리자 페이지(`/admin/`) UI/UX 시안 확정 및 레이아웃 개편
* **생성된 5종 UI 시안 아티팩트 참고:**
  1. `admin_ui_option_1_toss_sidebar_saas`: **토스/리니어 스타일 좌측 사이드바 SaaS (강력 추천)** — 좌측 카테고리 트리 + 상단 KPI + 중앙 차트/테이블
  2. `admin_ui_option_2_notion_split_cms`: **노션 스타일 3단 분할 CMS** — [카테고리] | [글 목록] | [속성 및 미리보기]
  3. `admin_ui_option_3_vercel_bento_dark`: **버셀 다크모드 벤토 그리드 관제 센터**
  4. `admin_ui_option_4_editorial_studio`: **미디어 편집국 & 애드센스 게이지형**
  5. `admin_ui_option_5_minimal_top_tabs`: **현재 블로그와 일치하는 상단 탭 카드형**
* **작업 목표:** 대표님이 선택하신 시안(예: 시안 1 좌측 사이드바형)에 맞춰 `/admin/index.html`을 전문 관리자 SaaS 형태로 고도화.

### Task 2: 카테고리 시스템 설계 및 관리자 편집 기능 구현
* **추천 카테고리 2단계 구조 (Taxonomy):**
  * **섹션 A: 🤖 AI 테크 (`/ko/category/ai/`)**
    * 중분류(기업별): `OpenAI`, `Google`, `Anthropic`, `Meta & xAI`
    * 태그: `#모델비교·벤치마크`, `#API·가격분석`, `#실전활용`, `#코딩에이전트`
  * **섹션 B: 📱 IT · 하드웨어 (`/ko/category/tech/`)**
    * 중분류(제조사별): `Samsung`, `Apple`, `NVIDIA & PC/칩셋`, `기타 글로벌`
    * 제품군 필터 태그: `📱 스마트폰`, `💻 노트북/PC`, `⌚ 웨어러블/태블릿`, `🖥️ 칩셋/GPU`
* **작업 목표:**
  1. `src/content/config.ts` 및 `scripts/build-static.mjs`에 `category` 및 `brand` / `tags` 스키마 반영.
  2. `/admin/`에 **[🗂️ 카테고리 관리]** 화면을 추가하여 제조사/기업 및 태그를 추가·수정할 수 있는 UI 구현.
  3. 사용자 프론트엔드(`index.html`)에 카테고리별 탭 및 제품군 필터링 기능 추가.

### Task 3: 관리자 페이지 보안 인증 고도화
* **현 상태:** 프론트엔드 암호(`2073`, `it365`) 기반 검증.
* **고도화 방안:**
  * **방안 A (추천): GitHub Personal Access Token (PAT) 또는 GitHub OAuth 연동**
    * 관리자 페이지에서 GitHub 토큰을 입력해 로그인하면, 관리자 페이지에서 카테고리를 수정하거나 글 상태를 변경했을 때 **GitHub API(`https://api.github.com/repos/NestJC/it365-blog/contents/...`)를 직접 호출하여 자동으로 GitHub 커밋 & 푸시**되도록 구현. (웹에서 바로 저장하면 사이트가 자동 배포되는 진짜 CMS화).
  * **방안 B: Cloudflare Zero Trust (무료)**
    * 클라우드플레어 Access에서 `it365.kr/admin/*` 경로에 대표님 구글 계정(`minung2073@gmail.com`) OTP 인증 규칙을 걸어 네트워크 단에서 원천 차단.

### Task 4: 블로그 원고 작성 템플릿(서식) 세부 확정
* 현재 [drafts/TEMPLATE_KO.md](file:///c:/Users/yminu/.gemini/antigravity/scratch/it365-blog/drafts/TEMPLATE_KO.md) 및 [drafts/TEMPLATE_EN.md](file:///c:/Users/yminu/.gemini/antigravity/scratch/it365-blog/drafts/TEMPLATE_EN.md)가 준비되어 있습니다.
* 대표님이 원하시는 제목 네이밍 룰, 서론 시작 형식, 비교표 배치, 캡션 스타일, 에디터 코멘트 박스 스타일을 확정하고 템플릿에 최종 반영.

---

## 6. 코덱스(Codex) 작업 시 유의사항 (빌드 & 푸시 규칙)

1. 파일을 수정한 후에는 항상 루트에서 `node scripts/build-static.mjs`를 실행하여 `docs/` 폴더의 HTML 파일들이 재생성되도록 해야 합니다.
2. `git add -A && git commit -m "..." && git push origin main`으로 푸시하면 GitHub Pages가 약 15~30초 내에 `https://it365.kr`에 자동 배포합니다.
3. 깃허브 푸시 시 네트워크 환경에 따라 SSL/Credential 오류가 발생하면 `BypassSandbox: true` (또는 프롬프트 터미널의 기본 git 인증) 환경에서 푸시해야 합니다. (이미 `gh.exe` 인증 헬퍼가 `.git/config`에 세팅되어 있어 `git push origin main`이 비밀번호 입력 없이 동작합니다).
