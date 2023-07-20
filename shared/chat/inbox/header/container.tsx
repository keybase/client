import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouterConstants from '../../../constants/router2'
import * as Container from '../../../util/container'
import ChatInboxHeader from '.'
import HiddenString from '../../../util/hidden-string'
import {appendNewChatBuilder} from '../../../actions/typed-routes'

type OwnProps = {
  headerContext: 'chat-header' | 'inbox-header'
}

export default (ownProps: OwnProps) => {
  const hasLoadedEmptyInbox = Container.useSelector(
    state =>
      state.chat2.inboxHasLoaded &&
      !!state.chat2.inboxLayout &&
      (state.chat2.inboxLayout.smallTeams || []).length === 0 &&
      (state.chat2.inboxLayout.bigTeams || []).length === 0
  )
  const showEmptyInbox = Container.useSelector(state => !state.chat2.inboxSearch && hasLoadedEmptyInbox)
  const showStartNewChat = !Container.isMobile && showEmptyInbox
  const isSearching = Container.useSelector(state => !!state.chat2.inboxSearch)
  const showFilter = !showEmptyInbox

  const dispatch = Container.useDispatch()
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onEnsureSelection = () => {
    dispatch(Chat2Gen.createInboxSearchSelect({}))
  }
  const onNewChat = () => {
    dispatch(appendNewChatBuilder())
  }
  const onQueryChanged = (query: string) => {
    dispatch(Chat2Gen.createInboxSearch({query: new HiddenString(query)}))
  }
  const onSelectDown = () => {
    dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: true}))
  }
  const onSelectUp = () => {
    dispatch(Chat2Gen.createInboxSearchMoveSelectedIndex({increment: false}))
  }
  const props = {
    isSearching: isSearching,
    onBack: onBack,
    onEnsureSelection: onEnsureSelection,
    onNewChat: onNewChat,
    onQueryChanged: onQueryChanged,
    onSelectDown: onSelectDown,
    onSelectUp: onSelectUp,
    showFilter: showFilter,
    showNewChat: ownProps.headerContext == 'chat-header',
    showSearch: ownProps.headerContext == 'chat-header' ? !Container.isTablet : Container.isMobile,
    showStartNewChat: showStartNewChat,
  }
  return <ChatInboxHeader {...props} />
}
