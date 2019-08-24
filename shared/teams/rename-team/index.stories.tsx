import * as React from 'react'
import * as Sb from '../../stories/storybook'
import RenameTeam from '.'

const props = {
  onCancel: Sb.action('onCancel'),
  onRename: Sb.action('onRename'),
  onSuccess: Sb.action('onSuccess'),
  teamname: 'teamname.withatypo',
  title: 'Rename subteam',
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Teams', module)
    .addDecorator(Sb.createPropProviderWithCommon())
    .add('Rename team', () => <RenameTeam {...props} />)
    .add('Rename team - error', () => <RenameTeam {...props} error="There was an error" />)
}

export default load
