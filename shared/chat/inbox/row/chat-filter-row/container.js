// @flow
import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {isDarwin, isMobile} from '../../../../constants/platform'
import {namedConnect, compose, withProps} from '../../../../util/container'
import ConversationFilterInput from '../../../conversation-filter-input'

type OwnProps = {
  onCancel: () => void,
  filterFocusCount: number,
  focusFilter: () => void,
  onEnsureSelection: () => void,
  onNewChat: () => void,
  onSelectDown: () => void,
  onSelectUp: () => void,
  onQueryChanged: string => void,
  query: string,
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  return {
    filter: ownProps.query,
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
  onFocus: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: true})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _onHotkey: dispatchProps._onHotkey,
  filter: stateProps.filter,
  filterFocusCount: ownProps.filterFocusCount,
  hotkeys: isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k'],
  isLoading: stateProps.isLoading,
  onBack: dispatchProps.onBack,
  onCancel: ownProps.onCancel,
  onEnsureSelection: ownProps.onEnsureSelection,
  onFocus: dispatchProps.onFocus,
  onNewChat: ownProps.onNewChat,
  onSelectDown: ownProps.onSelectDown,
  onSelectUp: ownProps.onSelectUp,
  onSetFilter: ownProps.onQueryChanged,
})

const KeyHandler = isMobile ? c => c : require('../../../../util/key-handler.desktop').default

export default compose(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'ChatFilterRow'),
  withProps<any, any, any>(props => ({
    onHotkey: (cmd: string) => props._onHotkey(cmd),
  }))
)(isMobile ? ConversationFilterInput : KeyHandler(ConversationFilterInput))
