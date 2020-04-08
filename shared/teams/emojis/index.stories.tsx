import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as TeamsTypes from '../../constants/types/teams'
import * as ChatConstants from '../../constants/chat2'
import {AddEmojiModal} from './add-emoji'
import {AddAliasModal} from './add-alias'

const load = () => {
  Sb.storiesOf('Teams/Emojis', module)
    .add('Add Emoji', () => (
      <AddEmojiModal conversationIDKey={ChatConstants.noConversationIDKey} teamID={TeamsTypes.noTeamID} />
    ))
    .add('Add Alias', () => <AddAliasModal conversationIDKey={ChatConstants.noConversationIDKey} />)
}

export default load
