import SharedNote from "./shared-note";

export default async function SharedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SharedNote slug={slug} />;
}
