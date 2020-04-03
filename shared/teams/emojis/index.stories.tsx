import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as TeamsTypes from '../../constants/types/teams'
import * as ChatConstants from '../../constants/chat2'
import {AddEmojiModal} from './add-emoji'

const load = () => {
  Sb.storiesOf('Teams/Emojis', module).add('Add Emoji', () => (
    <AddEmojiModal conversationIDKey={ChatConstants.noConversationIDKey} teamID={TeamsTypes.noTeamID} />
  ))
}

export default load
