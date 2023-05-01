import type * as Types from '../constants/types/chat2'
import * as React from 'react'
import * as Chat2Gen from '../actions/chat2-gen'
import {Channel} from './channel'
import * as Container from '../util/container'
import type {StylesTextCrossPlatform} from './text'

type OwnProps = {
  name: string
  convID: Types.ConversationIDKey
  style: StylesTextCrossPlatform
  allowFontScaling?: boolean | null
}

export default (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()

  const _onClick = React.useCallback(
    (name: string, convID: Types.ConversationIDKey) =>
      dispatch(
        Chat2Gen.createPreviewConversation({
          channelname: name,
          conversationIDKey: convID,
          reason: 'messageLink',
        })
      ),
    [dispatch]
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
