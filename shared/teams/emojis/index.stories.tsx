import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as TeamsTypes from '../../constants/types/teams'
import AddEmoji from './add-emoji'

const load = () => {
  Sb.storiesOf('Teams/Emojis', module).add('Add Emoji', () => <AddEmoji teamID={TeamsTypes.noTeamID} />)
}

export default load
