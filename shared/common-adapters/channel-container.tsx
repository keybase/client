import type * as Types from '../constants/types/chat2'
import * as ChatConstants from '../constants/chat2'
import * as React from 'react'
import {Channel} from './channel'
import type {StylesTextCrossPlatform} from './text'

type OwnProps = {
  name: string
  convID: Types.ConversationIDKey
  style: StylesTextCrossPlatform
  allowFontScaling?: boolean
}

export default (ownProps: OwnProps) => {
  const previewConversation = ChatConstants.useState(s => s.dispatch.previewConversation)
  const _onClick = React.useCallback(
    (name: string, convID: Types.ConversationIDKey) =>
      previewConversation({
        channelname: name,
        conversationIDKey: convID,
        reason: 'messageLink',
      }),
    [previewConversation]
  )

  const props = {
    allowFontScaling: ownProps.allowFontScaling,
    convID: ownProps.convID,
    name: ownProps.name,
    onClick: () => _onClick(ownProps.name, ownProps.convID),
    style: ownProps.style,
  }

  return <Channel {...props} />
}
