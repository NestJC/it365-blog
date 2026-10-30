import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => data.lang === 'ko' && !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: 'IT365.kr 한국어판 — 글로벌 AI & 빅테크 인사이트',
    description: '오픈AI, 구글, 앤트로픽 등 글로벌 AI 이슈와 빅테크 신제품 심층 분석 피드입니다.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/ko/blog/${post.slug.replace(/^ko\//, '')}/`,
    })),
    customData: `<language>ko-kr</language>`,
  });
}
