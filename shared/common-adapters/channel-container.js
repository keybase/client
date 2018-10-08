// @flow
import * as Types from '../constants/types/chat2'
import * as Chat2Gen from '../actions/chat2-gen'
import {Channel} from './channel'
import {connect, compose, setDisplayName, type TypedState} from '../util/container'
import type {StylesCrossPlatform} from '../styles'

type OwnProps = {|
  name: string,
  convID: Types.ConversationIDKey,
  style: StylesCrossPlatform,
  allowFontScaling?: ?boolean,
|}

const mapStateToProps = (state: TypedState) => ({})

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

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  allowFontScaling: ownProps.allowFontScaling,
  convID: ownProps.convID,
  name: ownProps.name,
  onClick: () => dispatchProps._onClick(ownProps.name, ownProps.convID),
  style: ownProps.style,
})

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('Channel')
)(Channel)
