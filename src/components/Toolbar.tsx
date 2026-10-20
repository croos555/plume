import {
  Bold,
  Code,
  Image,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Undo2
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { Strings } from '../lib/i18n'
import { modKey } from '../lib/api'

export type ToolAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'link'
  | 'image'
  | 'bullet'
  | 'number'
  | 'task'
  | 'quote'
  | 'code'
  | 'table'
  | 'divider'
  | 'undo'
  | 'redo'

interface Props {
  t: Strings
  headingLevel: number
  onHeading: (level: number) => void
  onAction: (a: ToolAction) => void
}

export function Toolbar({ t, headingLevel, onHeading, onAction }: Props) {
  const b = (action: ToolAction, icon: ReactNode, label: string, shortcut?: string) => (
    <button
      className="tool"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      // Keep the editor's selection: do not take the focus on mouse down
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onAction(action)}
    >
      {icon}
    </button>
  )
  return (
    <div className="toolbar" role="toolbar">
      <select
        className="heading-select"
        value={Math.min(headingLevel, 3)}
        title={t.heading}
        onChange={(e) => onHeading(Number(e.target.value))}
      >
        <option value={0}>{t.paragraph}</option>
        <option value={1}>{t.heading1}</option>
        <option value={2}>{t.heading2}</option>
        <option value={3}>{t.heading3}</option>
      </select>
      <span className="tool-sep" />
      {b('bold', <Bold size={17} />, t.bold, `${modKey}B`)}
      {b('italic', <Italic size={17} />, t.italic, `${modKey}I`)}
      {b('strike', <Strikethrough size={17} />, t.strike)}
      <span className="tool-sep" />
      {b('link', <Link size={17} />, t.link, `${modKey}K`)}
      {b('image', <Image size={17} />, t.image)}
      <span className="tool-sep" />
      {b('bullet', <List size={17} />, t.bulletList)}
      {b('number', <ListOrdered size={17} />, t.numberedList)}
      {b('task', <ListChecks size={17} />, t.taskList)}
      <span className="tool-sep" />
      {b('quote', <Quote size={17} />, t.quote)}
      {b('code', <Code size={17} />, t.code)}
      {b('table', <Table size={17} />, t.table)}
      {b('divider', <Minus size={17} />, t.divider)}
      <span className="tool-spacer" />
      {b('undo', <Undo2 size={17} />, t.undo, `${modKey}Z`)}
      {b('redo', <Redo2 size={17} />, t.redo)}
    </div>
  )
}
