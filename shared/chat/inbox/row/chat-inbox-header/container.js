// @flow
import * as Inbox from '../..'
import * as Constants from '../../../../constants/chat2'
import {connect, compose, setDisplayName} from '../../../../util/container'
import type {TypedState, Dispatch} from '../../../../util/container'
import ChatInboxHeader from '.'

type OwnProps = {
  onNewChat: () => void,
  filterFocusCount: number,
  focusFilter: () => void,
  rows: Array<Inbox.RowItem>,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => ({
  filter: state.chat2.inboxFilter,
  isLoading: Constants.anyChatWaitingKeys(state),
  neverLoaded: state.chat2.metaMap.isEmpty(),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  filterFocusCount: ownProps.filterFocusCount,
  focusFilter: ownProps.focusFilter,
  isLoading: stateProps.isLoading,
  onNewChat: ownProps.onNewChat,
  neverLoaded: stateProps.neverLoaded,
  rows: ownProps.rows,
  showNewChat: !(ownProps.rows.length || stateProps.filter),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ChatInboxHeaderContainer')
)(ChatInboxHeader)
