import * as React from 'react'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
export type Props = {
  previews?: Array<RPCChatTypes.GiphySearchResult>
  galleryURL: string
  onClick: (arg0: string) => void
}
export default class GiphySearch extends React.Component<Props> {}
