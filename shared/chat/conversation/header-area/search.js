// @flow
import UserInput from '../../../search/user-input/container'
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
  pendingConversationUsers: state.chat2.pendingConversationUsers,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onExitSearch: () => dispatch(Chat2Gen.createExitSearch({clear: true})),
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps),
  withStateHandlers(
    {focusInputCounter: 0},
    {incrementFocus: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1})}
  ),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      if (this.props.pendingConversationUsers !== nextProps.pendingConversationUsers) {
        nextProps.incrementFocus()
      }
    },
  }),
  withProps({
    autoFocus: true,
    searchKey: 'chatSearch',
  })
)(UserInput)
