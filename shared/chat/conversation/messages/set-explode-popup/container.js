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
  items: Constants.messageExplodeDescriptions,
  selected: Constants.getConversationExplodingMode(state, ownProps.conversationIDKey),
})

const mapDispatchToProps = (dispatch: Dispatch, ownProps: OwnProps) => ({
  onSelect: seconds =>
    dispatch(Chat2Gen.createSetConvExplodingMode({conversationIDKey: ownProps.conversationIDKey, seconds})),
})

const SetExplodePopup = connect(mapStateToProps, mapDispatchToProps)(SetExplodeTime)

export default SetExplodePopup
