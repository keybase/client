// @flow
import UserInput from '../../../search/user-input/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {
  connect,
  compose,
  withStateHandlers,
  lifecycle,
  withProps,
  type Dispatch,
} from '../../../util/container'

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onExitSearch: () => dispatch(Chat2Gen.createExitSearch()),
})

export default compose(
  connect(() => ({}), mapDispatchToProps),
  withStateHandlers(
    {focusInputCounter: 0},
    {incrementFocus: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1})}
  ),
  lifecycle({
    componentWillReceiveProps(nextProps) {
      if (this.props.selectedConversationIDKey !== nextProps.selectedConversationIDKey) {
        nextProps.incrementFocus()
      }
    },
  }),
  withProps({
    autoFocus: true,
    searchKey: 'chatSearch',
  })
)(UserInput)
