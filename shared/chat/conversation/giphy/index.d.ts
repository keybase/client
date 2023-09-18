import * as React from 'react'
import * as T from '../../../constants/types'
export type Props = {
  previews?: Array<T.RPCChat.GiphySearchResult>
  galleryURL: string
  onClick: (g: T.RPCChat.GiphySearchResult) => void
}
export default class GiphySearch extends React.Component<Props> {}
