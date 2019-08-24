import * as React from 'react'
import Delete from '.'
import {action, storiesOf} from '../../stories/storybook'

const load = () => {
  storiesOf('Settings', module).add('Delete', () => <Delete onDelete={action('onDelete')} />)
}

export default load
