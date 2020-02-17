import * as React from 'react'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import LoadingRow from '../../team/rows/loading'
import {Row} from '.'
import ChannelHeaderRow from '../header/container'

const renderRow = (row: Row, teamID: Types.TeamID, conversationIDKey: ChatTypes.ConversationIDKey) => {
  switch (row.type) {
    case 'header':
      return <ChannelHeaderRow teamID={teamID} conversationIDKey={conversationIDKey} />
    case 'loading':
      return <LoadingRow />
    case 'tabs':
      // Handled in team/index for now
      return null
  }
  return null
}

export default renderRow
