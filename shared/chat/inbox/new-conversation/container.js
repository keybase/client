// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import NewConversation from '.'

type Props = {
  shouldShow: boolean,
  isSelected: boolean,
  onClick: () => void,
  users: I.Set<string>,
}

const mapStateToProps = (state: TypedState): * => {
  const users = state.chat2.pendingConversationUsers
  // const selectedConversation = Constants.getSelectedConversation(state)
  // let isSelected = selectedConversation === Constants.pendingConversation
  // // also selected if the current convo is the same people as the search
  // if (!isSelected) {
  // const meta = Constants.getMeta(state, selectedConversation)
  // const you = state.config.username
  // isSelected = meta.participants.toSet().equals(users.concat([you]))
  // }

  return {
    isSelected: state.chat2.pendingSelected,
    shouldShow: state.chat2.pendingMode !== 'none',
    users,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClick: () => dispatch(Chat2Gen.createSetPendingSelected({selected: true})),
})

class NewChooser extends React.PureComponent<Props> {
  render() {
    return (
      this.props.shouldShow && (
        <NewConversation
          isSelected={this.props.isSelected}
          users={this.props.users.toArray()}
          onClick={this.props.onClick}
        />
      )
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(NewChooser)
