// @flow
import * as React from 'react'
import * as I from 'immutable'
import {connect, type TypedState} from '../../../util/container'
import NewConversation from '.'

type Props = {
  isSearching: boolean,
  users: I.Set<string>,
}

const mapStateToProps = (state: TypedState): * => ({
  isSearching: state.chat2.isSearching,
  users: state.chat2.pendingConversationUsers,
})

class NewChooser extends React.PureComponent<Props> {
  render() {
    return this.props.isSearching ? <NewConversation users={this.props.users.toArray()} /> : null
  }
}

export default connect(mapStateToProps)(NewChooser)
