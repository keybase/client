// @flow
import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import type {TypedState} from '../../../../util/container'
import type {Suggestor} from './interface'

const ChatUsers: Suggestor = {
  getFilter: (state: TypedState) => {
    const selectedConvID = Constants.getSelectedConversation(state)
    const meta = Constants.getMeta(state, selectedConvID)
    const you = state.config.username
    return (filter: string) =>
      meta.participants.filter(uname => uname !== you && uname.includes(filter)).toArray()
  },
  marker: '@',
  render: (username, selected) => (
    <Kb.NameWithIcon
      containerStyle={{
        backgroundColor: selected ? Styles.globalColors.blue4 : Styles.globalColors.white,
        paddingBottom: Styles.globalMargins.xtiny,
        paddingLeft: Styles.globalMargins.tiny + Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.xtiny,
      }}
      horizontal={true}
      username={username}
    />
  ),
  transform: input => input, // TODO
}

export default ChatUsers
