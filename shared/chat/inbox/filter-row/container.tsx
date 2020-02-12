import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import {appendNewChatBuilder} from '../../../actions/typed-routes'
import * as Container from '../../../util/container'
import ConversationFilterInput from '.'

type OwnProps = {
  onEnsureSelection: () => void
  onNewChat: () => void
  onSelectDown: () => void
  onSelectUp: () => void
  onQueryChanged: (arg0: string) => void
  query: string
  showNewChat: boolean
  showSearch: boolean
}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => ({
    filter: ownProps.query,
    isSearching: !!state.chat2.inboxSearch,
  }),
  dispatch => ({
    appendNewChatBuilder: () => dispatch(appendNewChatBuilder()),
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onStartSearch: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: true})),
    onStopSearch: () => dispatch(Chat2Gen.createToggleInboxSearch({enabled: false})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    appendNewChatBuilder: () => dispatchProps.appendNewChatBuilder(),
    filter: stateProps.filter,
    isSearching: stateProps.isSearching,
    onBack: dispatchProps.onBack,
    onEnsureSelection: ownProps.onEnsureSelection,
    onNewChat: ownProps.showNewChat ? ownProps.onNewChat : null,
    onSelectDown: ownProps.onSelectDown,
    onSelectUp: ownProps.onSelectUp,
    onSetFilter: ownProps.onQueryChanged,
    onStartSearch: dispatchProps.onStartSearch,
    onStopSearch: dispatchProps.onStopSearch,
    showNewChat: ownProps.showNewChat,
    showSearch: ownProps.showSearch,
  }),
  'ChatFilterRow'
)(ConversationFilterInput)
