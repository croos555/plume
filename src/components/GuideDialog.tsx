import { useMemo } from 'react'
import { Modal } from './Modal'
import type { Lang, Strings } from '../lib/i18n'
import { renderMarkdown } from '../lib/markdown'

const EXAMPLES: Record<Lang, string[]> = {
  en: [
    '# Title',
    '## Heading',
    '**bold** and _italic_',
    '~~crossed out~~',
    '[a link](https://example.com)',
    '- an item\n- another item',
    '1. first\n2. second',
    '- [x] done\n- [ ] to do',
    '> a quote',
    'some `code`',
    '| Name | Age |\n| ---- | --- |\n| Ann  | 32  |',
    'above\n\n---\n\nbelow'
  ],
  fr: [
    '# Titre',
    '## Sous-titre',
    '**gras** et _italique_',
    '~~barré~~',
    '[un lien](https://exemple.fr)',
    '- un élément\n- un autre',
    '1. premier\n2. deuxième',
    '- [x] fait\n- [ ] à faire',
    '> une citation',
    'du `code`',
    '| Nom | Âge |\n| --- | --- |\n| Léa | 32  |',
    'avant\n\n---\n\naprès'
  ]
}

export function GuideDialog({ t, lang, onClose }: { t: Strings; lang: Lang; onClose: () => void }) {
  const rows = useMemo(() => EXAMPLES[lang].map((src) => ({ src, html: renderMarkdown(src, { docDir: null }) })), [lang])
  return (
    <Modal title={t.guide} onClose={onClose} wide>
      <p className="guide-intro">{t.guideIntro}</p>
      <table className="guide">
        <thead>
          <tr>
            <th>{t.guideWrite}</th>
            <th>{t.guideGet}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.src}>
              <td>
                <pre>{r.src}</pre>
              </td>
              <td>
                <div className="markdown-body guide-result" dangerouslySetInnerHTML={{ __html: r.html }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  )
}
