import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
export type Props = {
  previews: Array<RPCChatTypes.GiphySearchResult> | null
  galleryURL: string
  onClick: (arg0: string) => void
}
