// @flow
import UserInput from '../../../search/user-input/container'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {
  connect,
  compose,
  withStateHandlers,
  lifecycle,
  withProps,
} from '../../../util/container'

const mapStateToProps = state => ({
  pendingConversationUsers: Constants.getMeta(state, Constants.pendingConversationIDKey).participants,
})

const mapDispatchToProps = (dispatch) => ({
  _onExitSearch: (participants: Array<string>) => dispatch(Chat2Gen.createCreateConversation({participants})),
  onClearSearch: () => dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    onExitSearch: () => dispatchProps._onExitSearch(stateProps.pendingConversationUsers.toArray()),
  }
}
export default compose(
connect<OwnProps, _,_,_,_>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  withStateHandlers(
    {focusInputCounter: 0},
    {incrementFocus: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1})}
  ),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (this.props.pendingConversationUsers !== prevProps.pendingConversationUsers) {
        this.props.incrementFocus()
      }
    },
  }),
  withProps({
    autoFocus: true,
    searchKey: 'chatSearch',
    placeholder: 'Search someone',
    showServiceFilter: true,
  })
)(UserInput)
