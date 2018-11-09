// @flow
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {isDarwin} from '../../../../constants/platform'
import {namedConnect, compose, withProps} from '../../../../util/container'
import ChatFilterRow from '.'

type OwnProps = {
  onNewChat: () => void,
  filterFocusCount: number,
  focusFilter: () => void,
  onSelectUp: () => void,
  onSelectDown: () => void,
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const filter = state.chat2.inboxFilter
  return {
    filter,
    isLoading: Constants.anyChatWaitingKeys(state),
  }
}

const mapDispatchToProps = (dispatch, {focusFilter}) => ({
  _onHotkey: (cmd: string) => {
    if (cmd.endsWith('+n')) {
      dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'searchingForUsers'}))
    } else {
      focusFilter()
    }
  },
  onSetFilter: (filter: string) => dispatch(Chat2Gen.createSetInboxFilter({filter})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _onHotkey: dispatchProps._onHotkey,
  filter: stateProps.filter,
  filterFocusCount: ownProps.filterFocusCount,
  hotkeys: isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k'],
  isLoading: stateProps.isLoading,
  onNewChat: ownProps.onNewChat,
  onSelectDown: ownProps.onSelectDown,
  onSelectUp: ownProps.onSelectUp,
  onSetFilter: dispatchProps.onSetFilter,
})

export default compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'ChatFilterRow'),
  withProps(props => ({
    onHotkey: (cmd: string) => props._onHotkey(cmd),
  }))
)(ChatFilterRow)
