import * as React from 'react'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
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
