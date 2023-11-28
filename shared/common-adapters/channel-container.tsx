import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as React from 'react'
import {Channel} from './channel'
import type {StylesTextCrossPlatform} from './text'

type OwnProps = {
  name: string
  convID: T.Chat.ConversationIDKey
  style: StylesTextCrossPlatform
  allowFontScaling?: boolean
}

const Container = (ownProps: OwnProps) => {
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const _onClick = React.useCallback(
    (name: string, convID: T.Chat.ConversationIDKey) =>
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

export default Container
