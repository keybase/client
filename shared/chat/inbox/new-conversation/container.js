// @flow
import * as React from 'react'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import {connect} from '../../../util/container'
import NewConversation from '.'

type Props = {
  isSelected: boolean,
  onCancel: () => void,
  onClick: () => void,
  shouldShow: boolean,
  users: Array<string>,
}

const mapStateToProps = state => {
  const _you = state.config.username
  const conversationIDKey = Constants.getSelectedConversation(state)
  const meta = Constants.getMeta(state, Constants.pendingConversationIDKey)

  return {
    _you,
    isSelected: conversationIDKey === Constants.pendingConversationIDKey,
    shouldShow: state.chat2.pendingMode !== 'none',
    users: meta.participants,
  }
}

const mapDispatchToProps = (dispatch) => ({
  onCancel: () => dispatch(Chat2Gen.createSetPendingMode({pendingMode: 'none', noneDestination: 'inbox'})),
  onClick: () =>
    dispatch(
      Chat2Gen.createSelectConversation({
        conversationIDKey: Constants.pendingConversationIDKey,
        reason: 'inboxNewConversation',
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  isSelected: stateProps.isSelected,
  onCancel: dispatchProps.onCancel,
  onClick: dispatchProps.onClick,
  shouldShow: stateProps.shouldShow,
  users: stateProps.users.filter(u => u !== stateProps._you).toArray(),
})

class NewChooser extends React.PureComponent<Props> {
  render() {
    return (
      this.props.shouldShow && (
        <NewConversation
          isSelected={this.props.isSelected}
          users={this.props.users}
          onClick={this.props.onClick}
          onCancel={this.props.onCancel}
        />
      )
    )
  }
}

export default connect<OwnProps, _,_,_,_>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(NewChooser)
