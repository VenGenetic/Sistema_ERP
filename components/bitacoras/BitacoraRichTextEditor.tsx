import React from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  SquareCode,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from 'lucide-react';
import { cn } from '../ui/styles';

/**
 * Clases del contenido editable. La app carga Tailwind por CDN sin el plugin
 * de tipografía, así que el estilo de párrafos/listas/citas se define acá
 * con variantes arbitrarias en vez de `prose`.
 */
const PROSE_CLASSES = cn(
  '[&_.ProseMirror]:min-h-[260px] [&_.ProseMirror]:outline-none',
  '[&_p]:my-2 [&_p.is-editor-empty:first-child]:before:pointer-events-none',
  '[&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0',
  '[&_p.is-editor-empty:first-child]:before:text-fg-subtle [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-fg',
  '[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-fg',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-fg',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-strong [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-fg-muted [&_blockquote]:my-2',
  '[&_code]:bg-surface-3 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:font-mono',
  '[&_pre]:bg-surface-3 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-xs [&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
  '[&_mark]:bg-warning-soft [&_mark]:rounded [&_mark]:px-0.5',
  '[&_hr]:my-4 [&_hr]:border-subtle',
);

export interface BitacoraRichTextEditorHandle {
  editor: Editor | null;
}

interface BitacoraRichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  className?: string;
  contentClassName?: string;
  placeholder?: string;
}

const ToolbarDivider = () => <span className="mx-1 h-5 w-px shrink-0 bg-subtle" aria-hidden="true" />;

const ToolbarButton: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-label={title}
    aria-pressed={active}
    className={cn(
      'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors',
      'hover:bg-surface-hover hover:text-fg disabled:opacity-40 disabled:pointer-events-none',
      active && 'bg-primary-soft text-primary-soft-fg hover:bg-primary-soft',
    )}
  >
    {children}
  </button>
);

const BitacoraToolbar: React.FC<{ editor: Editor | null }> = ({ editor }) => {
  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL del enlace:', previousUrl || 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-subtle bg-surface-2 px-2 py-1.5">
      <ToolbarButton title="Deshacer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Rehacer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 size={15} aria-hidden="true" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Párrafo" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
        <Pilcrow size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={15} aria-hidden="true" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Negrita" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Cursiva" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Subrayado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Resaltar" active={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter size={15} aria-hidden="true" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Alinear izquierda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Centrar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Alinear derecha" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight size={15} aria-hidden="true" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Lista con viñetas" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Cita" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Código en línea" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Bloque de código" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <SquareCode size={15} aria-hidden="true" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Insertar enlace" active={editor.isActive('link')} onClick={setLink}>
        <LinkIcon size={15} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton title="Quitar enlace" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}>
        <Unlink size={15} aria-hidden="true" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton title="Limpiar formato" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}>
        <RemoveFormatting size={15} aria-hidden="true" />
      </ToolbarButton>
    </div>
  );
};

/**
 * Editor de texto enriquecido de las Bitácoras.
 *
 * Basado en Tiptap (ProseMirror): el documento se valida contra un esquema
 * en vez de aceptar HTML arbitrario, así que pegar contenido no puede meter
 * `<script>` ni atributos sueltos — es la opción "segura y estándar" pedida.
 *
 * No es un componente controlado en cada tecla: el padre debe montarlo con
 * una `key` distinta por bitácora para cargar el contenido inicial correcto
 * al cambiar de una bitácora a otra.
 */
export const BitacoraRichTextEditor: React.FC<BitacoraRichTextEditorProps> = ({
  content,
  onChange,
  editable = true,
  className,
  contentClassName,
  placeholder = 'Escribe el contenido de la bitácora...',
}) => {
  const editor = useEditor({
    editable,
    extensions: [
      // Link y Underline ya vienen dentro de StarterKit v3: registrarlos
      // aparte duplica la extensión y sus atajos de teclado.
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  React.useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className={cn('flex flex-col rounded-lg border border-subtle bg-surface overflow-hidden', className)}>
      {editable && <BitacoraToolbar editor={editor} />}
      <div className={cn('flex-1 overflow-y-auto px-4 py-3 text-sm text-fg', PROSE_CLASSES, contentClassName)}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default BitacoraRichTextEditor;
