import type * as React from 'react'
import type * as T from '@/constants/types'
export type Props = {
  previews?: ReadonlyArray<T.RPCChat.GiphySearchResult>
  galleryURL: string
  onClick: (g: T.RPCChat.GiphySearchResult) => void
}
declare const GiphySearch: (p: Props) => React.ReactNode
export default GiphySearch
