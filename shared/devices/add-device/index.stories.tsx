import * as React from 'react'
import * as Sb from '../../stories/storybook'
import AddDevice from '.'

const props = {
  onAddComputer: Sb.action('onAddComputer'),
  onAddPaperKey: Sb.action('onAddPaperKey'),
  onAddPhone: Sb.action('onAddPhone'),
  onCancel: Sb.action('onCancel'),
  title: 'Add a device',
}

const load = () => {
  Sb.storiesOf('Devices', module).add('Add a device', () => <AddDevice {...props} />)
}

export default load
