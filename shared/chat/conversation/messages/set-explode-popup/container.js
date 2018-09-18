// @flow
import * as React from 'react'
import {connect, type TypedState} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Types from '../../../../constants/types/chat2'
import SetExplodeTime from '.'

type OwnProps = {
  attachTo: () => ?React.ElementRef<any>,
  conversationIDKey: Types.ConversationIDKey,
  /* Called after action selecting new explode time is dispatched */
  onAfterSelect?: (s: number) => void,
  onHidden: () => void,
  visible: boolean,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  isNew: Constants.getIsExplodingNew(state),
  items: Constants.messageExplodeDescriptions,
  selected: Constants.getConversationExplodingMode(state, ownProps.conversationIDKey),
})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onSelect: seconds => {
    dispatch(Chat2Gen.createSetConvExplodingMode({conversationIDKey: ownProps.conversationIDKey, seconds}))
    ownProps.onAfterSelect && ownProps.onAfterSelect(seconds)
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  attachTo: ownProps.attachTo,
  visible: ownProps.visible,
  onHidden: ownProps.onHidden,
  isNew: stateProps.isNew,
  selected: stateProps.selected,
  onSelect: dispatchProps.onSelect,
  items: stateProps.items,
})

const SetExplodePopup = connect(mapStateToProps, mapDispatchToProps, mergeProps)(SetExplodeTime)

export default SetExplodePopup
