import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {appendNewChatBuilder} from '../../../../actions/typed-routes'
import {isDarwin, isMobile} from '../../../../constants/platform'
import * as Container from '../../../../util/container'
import ConversationFilterInput from '.'

type OwnProps = {
  onEnsureSelection: () => void
  onNewChat: () => void
  onSelectDown: () => void
  onSelectUp: () => void
  onQueryChanged: (arg0: string) => void
  query: string
}

function KeyHandler<T>(t: T): T {
  return isMobile ? t : require('../../../../util/key-handler.desktop').default
}

const Component = isMobile ? ConversationFilterInput : KeyHandler(ConversationFilterInput)

export default Container.namedConnect(
  (state, ownProps: OwnProps) => ({
    filter: ownProps.query,
    isSearching: !!state.chat2.inboxSearch,
  }),
  dispatch => ({
    _onHotkey: (cmd: string) => {
      if (cmd.endsWith('+n')) {
        dispatch(appendNewChatBuilder())
      }
    },
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onStartSearch: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: true})),
    onStopSearch: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    filter: stateProps.filter,
    hotkeys: isDarwin ? ['command+n'] : ['ctrl+n'],
    isSearching: stateProps.isSearching,
    onBack: dispatchProps.onBack,
    onEnsureSelection: ownProps.onEnsureSelection,
    onHotkey: (cmd: string) => dispatchProps._onHotkey(cmd),
    onNewChat: ownProps.onNewChat,
    onSelectDown: ownProps.onSelectDown,
    onSelectUp: ownProps.onSelectUp,
    onSetFilter: ownProps.onQueryChanged,
    onStartSearch: dispatchProps.onStartSearch,
    onStopSearch: dispatchProps.onStopSearch,
  }),
  'ChatFilterRow'
)(Component)
