// @flow
import * as React from 'react'
import DeleteConfirm from '.'
import {action, storiesOf} from '../../stories/storybook'

const load = () => {
  storiesOf('Settings', module).add('DeleteConfirm', () => (
    <DeleteConfirm
      onDeleteForever={action('onDeleteForever')}
      onCancel={action('onCancel')}
      username={'chris'}
      allowDeleteForever={true}
      setAllowDeleteAccount={action('setAllowDeleteAccount')}
    />
  ))
}

export default load
