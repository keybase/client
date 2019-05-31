import * as React from 'react'
import * as Sb from '../../stories/storybook'
import DeleteTeam from '.'

const commonProps = {
  onBack: Sb.action('onBack'),
  onDelete: Sb.action('onDelete'),
  teamname: 'keybase',
  title: 'Delete team',
}

const load = () => {
  Sb.storiesOf('Teams/Roles', module).add('Delete team', () => <DeleteTeam {...commonProps} />)
}

export default load
