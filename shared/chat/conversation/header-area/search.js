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
  type TypedState,
  type Dispatch,
} from '../../../util/container'

const mapStateToProps = (state: TypedState) => ({
  pendingConversationUsers: Constants.getMeta(state, Constants.pendingConversationIDKey).participants,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClearSearch: () => dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
  onExitSearch: () => dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'none'})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
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
  withProps({autoFocus: true, searchKey: 'chatSearch'})
)(UserInput)
