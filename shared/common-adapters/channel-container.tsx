import type * as Types from '../constants/types/chat2'
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

export default Container.connect(
  () => ({}),
  dispatch => ({
    _onClick: (name: string, convID: Types.ConversationIDKey) =>
      dispatch(
        Chat2Gen.createPreviewConversation({
          channelname: name,
          conversationIDKey: convID,
          reason: 'messageLink',
        })
      ),
  }),
  (_, dispatchProps, ownProps: OwnProps) => ({
    allowFontScaling: ownProps.allowFontScaling,
    convID: ownProps.convID,
    name: ownProps.name,
    onClick: () => dispatchProps._onClick(ownProps.name, ownProps.convID),
    style: ownProps.style,
  })
)(Channel)
