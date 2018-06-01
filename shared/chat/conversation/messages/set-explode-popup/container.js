// @flow
import * as React from 'react'
import {connect, type TypedState} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Types from '../../../../constants/types/chat2'
import SetExplodeTime from '.'

type OwnProps = {
  attachTo: ?React.Component<any, any>,
  conversationIDKey: Types.ConversationIDKey,
  onHidden: () => void,
  visible: boolean,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  isNew: Constants.getIsExplodingNew(state),
  selected: Constants.getConversationExplodingMode(state, ownProps.conversationIDKey),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onHidden: () => {
    dispatch(Chat2Gen.createHandleSeeingExplodingMessages())
    ownProps.onHidden()
  },
  onSelect: seconds =>
    dispatch(Chat2Gen.createSetConvExplodingMode({conversationIDKey: ownProps.conversationIDKey, seconds})),
})

// make sure we override onHidden with the one in dispatchProps
const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
  ...dispatchProps,
  attachTo: ownProps.attachTo,
  items: Constants.messageExplodeDescriptions,
  visible: ownProps.visible,
})

const SetExplodePopup = connect(mapStateToProps, mapDispatchToProps, mergeProps)(SetExplodeTime)

export default SetExplodePopup
