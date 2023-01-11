import * as React from 'react'
import type * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import HiddenString from '../../../util/hidden-string'
import GiphySearch from '.'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const GiphySearchContainer = React.memo(function GiphySearchContainer(p: OwnProps) {
  const {conversationIDKey} = p
  const giphy = Container.useSelector(state => state.chat2.giphyResultMap.get(conversationIDKey) ?? null)
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(
    (url: string) => {
      dispatch(Chat2Gen.createGiphySend({conversationIDKey, url: new HiddenString(url)}))
    },
    [dispatch, conversationIDKey]
  )
  const props = {
    galleryURL: giphy?.galleryUrl ?? '',
    onClick,
    previews: giphy?.results ?? null,
  }
  return <GiphySearch {...props} />
})
export default GiphySearchContainer
