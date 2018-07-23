// @flow
import * as Inbox from '../..'
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
})

const mapDispatchToProps = (dispatch: Dispatch) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  filterFocusCount: ownProps.filterFocusCount,
  focusFilter: ownProps.focusFilter,
  onNewChat: ownProps.onNewChat,
  rows: ownProps.rows,
  showNewChat: !(ownProps.rows.length || stateProps.filter),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ChatInboxHeaderContainer')
)(ChatInboxHeader)
