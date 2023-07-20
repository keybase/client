import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RouterConstants from '../../../constants/router2'
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

export default (ownProps: OwnProps) => {
  const filter = ownProps.query
  const isSearching = Container.useSelector(state => !!state.chat2.inboxSearch)
  const dispatch = Container.useDispatch()
  const _appendNewChatBuilder = () => {
    dispatch(appendNewChatBuilder())
  }
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onBack = () => {
    navigateUp()
  }
  const onStartSearch = () => {
    dispatch(Chat2Gen.createToggleInboxSearch({enabled: true}))
  }
  const onStopSearch = () => {
    dispatch(Chat2Gen.createToggleInboxSearch({enabled: false}))
  }
  const props = {
    appendNewChatBuilder: _appendNewChatBuilder,
    filter,
    isSearching,
    onBack: onBack,
    onEnsureSelection: ownProps.onEnsureSelection,
    onNewChat: ownProps.showNewChat ? ownProps.onNewChat : null,
    onSelectDown: ownProps.onSelectDown,
    onSelectUp: ownProps.onSelectUp,
    onSetFilter: ownProps.onQueryChanged,
    onStartSearch: onStartSearch,
    onStopSearch: onStopSearch,
    showNewChat: ownProps.showNewChat,
    showSearch: ownProps.showSearch,
  }
  return <ConversationFilterInput {...props} />
}
