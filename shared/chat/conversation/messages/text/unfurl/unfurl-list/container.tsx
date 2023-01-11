import * as React from 'react'
import * as Constants from '../../../../../../constants/chat2'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Types from '../../../../../../constants/types/chat2'
import * as Container from '../../../../../../util/container'
import {ConvoIDContext, OrdinalContext} from '../../../ids-context'
import UnfurlList from '.'

type OwnProps = {
  toggleMessagePopup: () => void
}

const UnfurlListContainer = React.memo(function UnfurlListContainer(p: OwnProps) {
  const {toggleMessagePopup} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  const you = Container.useSelector(state => state.config.username)
  const _unfurls = message && message.type === 'text' ? message.unfurls : null
  const author = message ? message.author : undefined
  const isAuthor = message ? you === message.author : false
  const dispatch = Container.useDispatch()
  const onClose = (messageID: Types.MessageID) => {
    dispatch(Chat2Gen.createUnfurlRemove({conversationIDKey, messageID}))
  }
  const onCollapse = (messageID: Types.MessageID, collapse: boolean) => {
    dispatch(Chat2Gen.createToggleMessageCollapse({collapse, conversationIDKey, messageID}))
  }
  const unfurls = _unfurls
    ? [..._unfurls.values()].map(u => {
        return {
          isCollapsed: u.isCollapsed,
          onClose: isAuthor ? () => onClose(Types.numberToMessageID(u.unfurlMessageID)) : undefined,
          onCollapse: () => onCollapse(Types.numberToMessageID(u.unfurlMessageID), !u.isCollapsed),
          unfurl: u.unfurl,
          url: u.url,
        }
      })
    : []
  const props = {
    author,
    conversationIDKey,
    isAuthor,
    toggleMessagePopup,
    unfurls,
  }
  return <UnfurlList {...props} />
})
export default UnfurlListContainer
