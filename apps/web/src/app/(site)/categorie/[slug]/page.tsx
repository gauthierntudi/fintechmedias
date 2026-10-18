import { notFound, redirect } from "next/navigation";
import { legacyCategorySlug } from "@/lib/rubriques";

type Props = { params: Promise<{ slug: string }> };

/** Anciennes URLs PHP `/categorie/{Nom}`. */
export default async function LegacyCategoryPage({ params }: Props) {
  const { slug } = await params;
  const canonical = legacyCategorySlug(slug);
  if (!canonical) notFound();
  redirect(`/rubrique/${canonical}`);
}
