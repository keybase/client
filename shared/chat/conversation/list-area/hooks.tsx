import * as React from 'react'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import JumpToRecent from './jump-to-recent'
import type * as Types from '../../../constants/types/chat2'

export const useActions = (p: {conversationIDKey: Types.ConversationIDKey}) => {
  const {conversationIDKey} = p
  const dispatch = Container.useDispatch()
  const markInitiallyLoadedThreadAsRead = React.useCallback(() => {
    dispatch(Chat2Gen.createMarkInitiallyLoadedThreadAsRead({conversationIDKey}))
  }, [dispatch, conversationIDKey])

  return {markInitiallyLoadedThreadAsRead}
}

export const useIsMounted = () => {
  const isMountedRef = React.useRef(true)
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])
  return isMountedRef
}

export const useJumpToRecent = (
  conversationIDKey: Types.ConversationIDKey,
  scrollToBottom: () => void,
  numOrdinals: number
) => {
  const dispatch = Container.useDispatch()

  const containsLatestMessage = Container.useSelector(
    state => state.chat2.containsLatestMessageMap.get(conversationIDKey) || false
  )

  const jumpToRecent = React.useCallback(() => {
    scrollToBottom()
    dispatch(Chat2Gen.createJumpToRecent({conversationIDKey}))
    dispatch(Chat2Gen.createToggleThreadSearch({conversationIDKey, hide: true}))
  }, [dispatch, conversationIDKey, scrollToBottom])

  return !containsLatestMessage && numOrdinals > 0 && <JumpToRecent onClick={jumpToRecent} />
}
