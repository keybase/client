// @flow
import * as React from 'react'
import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Types from '../../../../../constants/types/chat2'
import type {StylesCrossPlatform} from '../../../../../styles'
import EmojiRow from '.'

type OwnProps = {|
  attachTo: () => ?React.Component<any>,
  conversationIDKey: Types.ConversationIDKey,
  onShowPicker: boolean => void,
  ordinal: Types.Ordinal,
  style?: StylesCrossPlatform,
  visible: boolean,
|}

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch, {conversationIDKey, ordinal}) => ({
  onReact: (emoji: string) =>
    dispatch(
      Chat2Gen.createToggleMessageReaction({
        conversationIDKey,
        emoji,
        ordinal,
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  attachTo: ownProps.attachTo,
  onReact: dispatchProps.onReact,
  onShowPicker: ownProps.onShowPicker,
  style: ownProps.style,
  visible: ownProps.visible,
})

const ConnectedEmojiRow = Container.namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedEmojiRow'
)(EmojiRow)

export default ConnectedEmojiRow
