// @flow
import React from 'react'
import {MentionHud} from '.'
import {createSelector} from 'reselect'
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

const fullNameSelector = inbox => (inbox ? inbox.get('fullNames') : null)
const participantsSelector = inbox => (inbox ? inbox.get('participants') : null)
const userSelector = createSelector(fullNameSelector, participantsSelector, (fullNames, participants) => {
  const fullNameArray = fullNames ? fullNames.toArray() : []
  const participantsArray = participants ? participants.toArray() : []
  return participantsArray.reduce((res, username) => {
    const fullName = fullNameArray.find(fn => username === fn[0])
    res.push({username, fullName: fullName ? fullName[1] : ''})
    return res
  }, [])
})

const mapStateToProps: MapStateToProps<*, *, *> = state => {
  const inbox = getSelectedInbox(state)
  return {
    users: userSelector(inbox),
  }
}

const ConnectedMentionHud: Class<React.Component<ConnectedMentionHudProps, void>> = connect(mapStateToProps)(
  MentionHud
)

export default ConnectedMentionHud
