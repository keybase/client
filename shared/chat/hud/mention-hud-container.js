// @flow
import React from 'react'
import {MentionHud} from '.'
import {createSelector} from 'reselect'
import {connect, type MapStateToProps} from 'react-redux'
import {getGeneralChannelOfSelectedInbox} from '../../constants/chat'

type ConnectedMentionHudProps = {
  onPickUser: (user: string) => void,
  onSelectUser: (user: string) => void,
  selectUpCounter: number,
  selectDownCounter: number,
  pickSelectedUserCounter: number,
  filter: string,
  style?: Object,
}

const fullNameSelector = createSelector(
  getGeneralChannelOfSelectedInbox,
  inbox => (inbox ? inbox.get('fullNames') : null)
)
const participantsSelector = createSelector(
  getGeneralChannelOfSelectedInbox,
  inbox => (inbox ? inbox.get('participants') : null)
)

const userSelector = createSelector(fullNameSelector, participantsSelector, (fullNames, participants) => {
  return participants
    ? participants.reduce((res, username) => {
        const fullName = fullNames ? fullNames.get(username) : ''
        res.push({fullName: fullName || '', username})
        return res
      }, [])
    : []
})

const mapStateToProps: MapStateToProps<*, *, *> = (state, {filter}) => {
  return {
    users: userSelector(state),
    filter: filter.toLowerCase(),
  }
}

const ConnectedMentionHud: Class<React.Component<ConnectedMentionHudProps, void>> = connect(mapStateToProps)(
  MentionHud
)

export default ConnectedMentionHud
