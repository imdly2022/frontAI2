import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";
import { toast } from "sonner";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Link as LinkIcon, Image as ImageIcon,
  Undo2, Redo2, Minus, Code2,
} from "lucide-react";
import { adminUploadDocImage } from "@/lib/admin.functions";

export function RichEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const upload = useServerFn(adminUploadDocImage);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: "rounded-md bg-muted p-3 text-xs" } } }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg my-4 max-w-full h-auto" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline underline-offset-2" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Write your documentation…" }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose-docs max-w-none min-h-[420px] focus:outline-none px-5 py-4",
      },
    },
  });

  if (!editor) return null;

  async function pickAndUpload(file: File) {
    if (file.size > 6 * 1024 * 1024) { toast.error("Image too large (max 6MB)"); return; }
    const buf = await file.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    const t = toast.loading("Uploading image…");
    try {
      const { url } = await upload({ data: { filename: file.name, contentType: file.type, base64 } });
      editor?.chain().focus().setImage({ src: url, alt: file.name }).run();
      toast.success("Image inserted", { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed", { id: t });
    }
  }

  function promptLink() {
    const prev = editor!.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor!.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
    editor!.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  }

  return (
    <div className="rounded-lg border border-input bg-background/50 overflow-hidden">
      <Toolbar editor={editor} onUploadClick={() => fileRef.current?.click()} onLinkClick={promptLink} />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickAndUpload(f);
          e.target.value = "";
        }}
      />
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, onUploadClick, onLinkClick }: { editor: Editor; onUploadClick: () => void; onLinkClick: () => void }) {
  const Btn = ({ on, active, children, title }: { on: () => void; active?: boolean; children: React.ReactNode; title: string }) => (
    <button
      type="button"
      onClick={on}
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors ${
        active ? "bg-primary/15 text-primary" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
  const Sep = () => <span className="mx-1 h-5 w-px bg-border" />;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-muted/30 px-2 py-1.5">
      <Btn title="Bold" on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><Bold className="h-4 w-4" /></Btn>
      <Btn title="Italic" on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><Italic className="h-4 w-4" /></Btn>
      <Btn title="Strike" on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><Strikethrough className="h-4 w-4" /></Btn>
      <Btn title="Inline code" on={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><Code className="h-4 w-4" /></Btn>
      <Sep />
      <Btn title="H1" on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}><Heading1 className="h-4 w-4" /></Btn>
      <Btn title="H2" on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}><Heading2 className="h-4 w-4" /></Btn>
      <Btn title="H3" on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}><Heading3 className="h-4 w-4" /></Btn>
      <Sep />
      <Btn title="Bullet list" on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}><List className="h-4 w-4" /></Btn>
      <Btn title="Numbered list" on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}><ListOrdered className="h-4 w-4" /></Btn>
      <Btn title="Quote" on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}><Quote className="h-4 w-4" /></Btn>
      <Btn title="Code block" on={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}><Code2 className="h-4 w-4" /></Btn>
      <Btn title="Divider" on={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
      <Sep />
      <Btn title="Link" on={onLinkClick} active={editor.isActive("link")}><LinkIcon className="h-4 w-4" /></Btn>
      <Btn title="Image" on={onUploadClick}><ImageIcon className="h-4 w-4" /></Btn>
      <Sep />
      <Btn title="Undo" on={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></Btn>
      <Btn title="Redo" on={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></Btn>
    </div>
  );
}
