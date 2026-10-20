import { forwardRef, memo } from 'react'

interface Props {
  html: string
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void
}

/** Rendered document. The HTML comes from renderMarkdown, already sanitized. */
export const Preview = memo(
  forwardRef<HTMLDivElement, Props>(function Preview({ html, onClick }, ref) {
    return (
      <div className="preview-scroll" ref={ref}>
        <article className="markdown-body" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    )
  })
)
