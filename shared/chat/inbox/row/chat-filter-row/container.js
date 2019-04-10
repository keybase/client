// @flow
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {isDarwin, isMobile} from '../../../../constants/platform'
import {namedConnect, compose, withProps} from '../../../../util/container'
import ConversationFilterInput from '../../../conversation-filter-input'
import HiddenString from '../../../../util/hidden-string'

type OwnProps = {
  filterFocusCount: number,
  focusFilter: () => void,
  onEnsureSelection: () => void,
  onNewChat: () => void,
  onSelectDown: () => void,
  onSelectUp: () => void,
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
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {}, selected: 'chatNewChat'}],
        })
      )
    } else {
      focusFilter()
    }
  },
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onBlur: () => dispatch(Chat2Gen.createChangeFocus({nextFocus: null})),
  onFocus: () => dispatch(Chat2Gen.createChangeFocus({nextFocus: 'filter'})),
  onSetFilter: (filter: string) => dispatch(Chat2Gen.createInboxSearch({query: new HiddenString(filter)})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _onHotkey: dispatchProps._onHotkey,
  filter: stateProps.filter,
  filterFocusCount: ownProps.filterFocusCount,
  hotkeys: isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k'],
  isLoading: stateProps.isLoading,
  onBack: dispatchProps.onBack,
  onBlur: dispatchProps.onBlur,
  onEnsureSelection: ownProps.onEnsureSelection,
  onFocus: dispatchProps.onFocus,
  onNewChat: ownProps.onNewChat,
  onSelectDown: ownProps.onSelectDown,
  onSelectUp: ownProps.onSelectUp,
  onSetFilter: dispatchProps.onSetFilter,
})

const KeyHandler = isMobile ? c => c : require('../../../../util/key-handler.desktop').default

export default compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'ChatFilterRow'),
  withProps<any, any, any>(props => ({
    onHotkey: (cmd: string) => props._onHotkey(cmd),
  }))
)(isMobile ? ConversationFilterInput : KeyHandler(ConversationFilterInput))
