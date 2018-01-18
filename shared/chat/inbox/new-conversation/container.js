// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Chat2Gen from '../../../actions/chat2-gen'
import {connect, type TypedState, type Dispatch} from '../../../util/container'
import NewConversation from '.'

type Props = {
  isSearching: boolean,
  users: I.Set<string>,
  onClick: () => void,
}

const mapStateToProps = (state: TypedState): * => ({
  isSearching: state.chat2.isSearching,
  users: state.chat2.pendingConversationUsers,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onClick: () => dispatch(Chat2Gen.createSetSearching({searching: true})),
})

class NewChooser extends React.PureComponent<Props> {
  render() {
    return this.props.users.isEmpty() && !this.props.isSearching ? null : (
      <NewConversation
        isSearching={this.props.isSearching}
        users={this.props.users.toArray()}
        onClick={this.props.onClick}
      />
    )
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(NewChooser)
