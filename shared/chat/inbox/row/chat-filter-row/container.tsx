import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {appendNewChatBuilder} from '../../../../actions/typed-routes'
import {isDarwin, isMobile} from '../../../../constants/platform'
import {namedConnect, compose, withProps} from '../../../../util/container'
import ConversationFilterInput from '../../../conversation-filter-input'

type OwnProps = {
  onEnsureSelection: () => void
  onNewChat: () => void
  onSelectDown: () => void
  onSelectUp: () => void
  onQueryChanged: (arg0: string) => void
  query: string
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  return {
    filter: ownProps.query,
    isLoading: Constants.anyChatWaitingKeys(state),
    isSearching: !!state.chat2.inboxSearch,
    showNewTag: state.chat2.inboxShowNew,
  }
}

const mapDispatchToProps = (dispatch) => ({
  _onHotkey: (cmd: string) => {
    if (cmd.endsWith('+n')) {
      dispatch(appendNewChatBuilder())
    } else {
      dispatch(Chat2Gen.createToggleInboxSearch({enabled: true}))
    }
  },
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
  onStartSearch: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: true})),
  onStopSearch: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  _onHotkey: dispatchProps._onHotkey,
  filter: stateProps.filter,
  hotkeys: isDarwin ? ['command+n', 'command+k'] : ['ctrl+n', 'ctrl+k'],
  isLoading: stateProps.isLoading,
  isSearching: stateProps.isSearching,
  onBack: dispatchProps.onBack,
  onEnsureSelection: ownProps.onEnsureSelection,
  onNewChat: ownProps.onNewChat,
  onSelectDown: ownProps.onSelectDown,
  onSelectUp: ownProps.onSelectUp,
  onSetFilter: ownProps.onQueryChanged,
  onStartSearch: dispatchProps.onStartSearch,
  onStopSearch: dispatchProps.onStopSearch,
  showNewTag: stateProps.showNewTag,
})

const KeyHandler = isMobile ? c => c : require('../../../../util/key-handler.desktop').default

export default compose(
  // @ts-ignore TODO remove compose
  namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ChatFilterRow'),
  withProps<any, any>((props: any) => ({
    onHotkey: (cmd: string) => props._onHotkey(cmd),
  }))
)(isMobile ? ConversationFilterInput : KeyHandler(ConversationFilterInput)) as any
