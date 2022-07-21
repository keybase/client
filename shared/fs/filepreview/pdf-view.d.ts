import * as React from 'react'

export type Props = {
  url: string
  onUrlError?: (err: string) => void
}

declare const PdfView: React.ComponentType<Props>
export default PdfView
