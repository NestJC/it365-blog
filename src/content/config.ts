import { defineCollection, z } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(10, '제목은 검색 키워드를 포함하여 10자 이상이어야 합니다.'),
    description: z.string().min(30, '메타 설명은 SEO를 위해 30자 이상이어야 합니다.'),
    lang: z.enum(['ko', 'en']),
    translationKey: z.string().min(3, '한/영 짝꿍 글 연결을 위한 translationKey가 필요합니다.'),
    category: z.enum(['ai-issue', 'bigtech-weekly', 'hands-on']),
    company: z.string().default('General'),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().min(5, '이미지 SEO를 위한 alt 설명(heroImageAlt)은 필수입니다.'),
    takeaways: z
      .array(z.string())
      .min(2, '상단 핵심 요약 박스(takeaways)는 최소 2~3줄 이상이어야 합니다.')
      .max(5),
    editorNote: z
      .string()
      .min(10, 'E-E-A-T(저품질 방지)를 위해 사용자 코멘트가 반영된 editorNote가 필수입니다.'),
    coupangEnabled: z.boolean().default(false),
    coupangItems: z
      .array(
        z.object({
          name: z.string(),
          summary: z.string(),
          priceHint: z.string().optional(),
          url: z.string().url(),
        })
      )
      .default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  blog: blogCollection,
};
