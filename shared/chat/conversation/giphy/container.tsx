import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import GiphySearch from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const GiphySearchContainer = React.memo(function GiphySearchContainer(p: OwnProps) {
  const {conversationIDKey} = p
  const giphy = Container.useSelector(state => state.chat2.giphyResultMap.get(conversationIDKey))
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(
    (result: RPCChatTypes.GiphySearchResult) => {
      dispatch(Chat2Gen.createGiphySend({conversationIDKey, result}))
    },
    [dispatch, conversationIDKey]
  )
  const props = {
    galleryURL: giphy?.galleryUrl ?? '',
    onClick,
    previews: giphy?.results ?? undefined,
  }
  return <GiphySearch {...props} />
})
export default GiphySearchContainer
