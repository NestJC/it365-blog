import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = (await getCollection('blog', ({ data }) => data.lang === 'en' && !data.draft)).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: 'IT365.kr English — Global AI & Big Tech Insights',
    description: 'Daily analysis of frontier AI models, API pricing comparisons, and Big Tech hardware.',
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/en/blog/${post.slug.replace(/^en\//, '')}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
