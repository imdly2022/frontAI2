// Renders admin-defined <script> / HTML snippets into the page.
// Snippets come from public.custom_scripts and are scoped by route name.
// `placement` is "head" or "body_end" — both are rendered as raw HTML.

export function CustomScripts({
  scripts,
  placement,
}: {
  scripts: Array<{ placement: string; code: string }>;
  placement: "head" | "body_end";
}) {
  const items = scripts.filter((s) => s.placement === placement);
  if (items.length === 0) return null;
  return (
    <>
      {items.map((s, i) => (
        <div
          key={i}
          // Admin-curated content; intentional raw HTML for tracking pixels / GTM.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: s.code }}
        />
      ))}
    </>
  );
}
