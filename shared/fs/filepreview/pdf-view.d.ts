import type * as React from 'react'

export type Props = {
  url: string
  onUrlError?: ((err: string) => void) | undefined
}

declare const PdfView: (p: Props) => React.ReactNode
export default PdfView
