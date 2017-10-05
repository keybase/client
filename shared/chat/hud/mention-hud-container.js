// @flow
import React from 'react'
import {MentionHud} from '.'
import {connect} from 'react-redux'
import {getSelectedInbox} from '../../constants/chat'

type ConnectedMentionHudProps = {
  onPickUser: (user: string) => void,
  onSelectUser: (user: string) => void,
  selectUpCounter: number,
  selectDownCounter: number,
  pickSelectedUserCounter: number,
  filter: string,
  style?: Object,
}

const ConnectedMentionHud: Class<React.Component<ConnectedMentionHudProps, void>> = connect(state => {
  const inbox = getSelectedInbox(state)
  const participants = inbox ? inbox.get('participants').toArray() : []
  return {
    userIds: participants,
  }
})(MentionHud)

export default ConnectedMentionHud
