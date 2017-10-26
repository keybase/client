// @flow
import React from 'react'
import {MentionHud} from '.'
import {connect, type MapStateToProps} from 'react-redux'
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

const mapStateToProps: MapStateToProps<*, *, *> = state => {
  const inbox = getSelectedInbox(state)
  const users = inbox ? inbox.get('fullNames').toArray() : []
  return {
    users,
  }
}

const ConnectedMentionHud: Class<React.Component<ConnectedMentionHudProps, void>> = connect(mapStateToProps)(
  MentionHud
)

export default ConnectedMentionHud
