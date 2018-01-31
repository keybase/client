// @flow
import React from 'react'
import {MentionHud} from '.'
import {connect} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'

type ConnectedMentionHudProps = {
  conversationIDKey: Types.ConversationIDKey,
  onPickUser: (user: string) => void,
  onSelectUser: (user: string) => void,
  selectUpCounter: number,
  selectDownCounter: number,
  pickSelectedUserCounter: number,
  filter: string,
  style?: Object,
}

// const fullNameSelector = createSelector(
// Constants.getGeneralChannelOfSelectedInbox,
// inbox => (inbox ? inbox.get('fullNames') : null)
// )
// const participantsSelector = createSelector(
// Constants.getGeneralChannelOfSelectedInbox,
// inbox => (inbox ? inbox.get('participants') : null)
// )

// const userSelector = createSelector(fullNameSelector, participantsSelector, (fullNames, participants) => {
// return participants
// ? participants.reduce((res, username) => {
// const fullName = fullNames ? fullNames.get(username) : ''
// res.push({fullName: fullName || '', username})
// return res
// }, [])
// : []
// })

const mapStateToProps = (state, {filter, conversationIDKey}): * => {
  const meta = Constants.getMeta(state, conversationIDKey)
  return {
    conversationIDKey,
    filter: filter.toLowerCase(),
    users: meta.participants.map(p => ({fullName: '', username: p})).toArray(),
  }
}

const ConnectedMentionHud: Class<React.Component<ConnectedMentionHudProps, void>> = connect(mapStateToProps)(
  MentionHud
)

export default ConnectedMentionHud
