import * as React from 'react'
import * as Sb from '../../stories/storybook'
import CreateNewTeam from '.'

const commonProps = {
  errorText: '',
  onCancel: Sb.action('onCancel'),
  onClearError: Sb.action('onClearError'),
  onSubmit: Sb.action('onSubmit'),
}

const load = () => {
  Sb.storiesOf('Teams/Create a team', module)
    .add('Root team', () => <CreateNewTeam {...commonProps} />)
    .add('Subteam', () => <CreateNewTeam {...commonProps} baseTeam="keybase" />)
}

export default load
