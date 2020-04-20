import * as React from 'react'
import * as Sb from '../../stories/storybook'
import DeleteConfirm from '.'

const load = () => {
  Sb.storiesOf('Settings', module).add('DeleteConfirm', () => <DeleteConfirm />)
}

export default load
