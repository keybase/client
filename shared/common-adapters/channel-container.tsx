import * as Types from '../constants/types/chat2'
import * as Chat2Gen from '../actions/chat2-gen'
import {Channel} from './channel'
import {namedConnect} from '../util/container'
import {StylesTextCrossPlatform} from '../common-adapters/text'

type OwnProps = {
  name: string
  convID: Types.ConversationIDKey
  style: StylesTextCrossPlatform
  allowFontScaling?: boolean | null
}

const mapStateToProps = () => ({})

const mapDispatchToProps = dispatch => ({
  _onClick: (name, convID) =>
    dispatch(
      Chat2Gen.createPreviewConversation({
        channelname: name,
        conversationIDKey: convID,
        reason: 'messageLink',
      })
    ),
})

const mergeProps = (_, dispatchProps, ownProps: OwnProps) => ({
  allowFontScaling: ownProps.allowFontScaling,
  convID: ownProps.convID,
  name: ownProps.name,
  onClick: () => dispatchProps._onClick(ownProps.name, ownProps.convID),
  style: ownProps.style,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Channel')(Channel)
