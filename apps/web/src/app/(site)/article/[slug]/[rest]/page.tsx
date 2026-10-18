import { notFound, redirect } from "next/navigation";
import { articlesPublicApi } from "@/lib/api";

type Props = { params: Promise<{ slug: string; rest: string }> };

/** Anciennes URLs PHP `/article/{id}/{slug}`. */
export default async function LegacyArticlePage({ params }: Props) {
  const { slug } = await params;
  if (!/^\d+$/.test(slug)) notFound();

  let target = "";
  try {
    const article = await articlesPublicApi.byLegacyId(slug);
    target = article.slug;
  } catch {
    notFound();
  }
  redirect(`/article/${encodeURIComponent(target)}`);
}
