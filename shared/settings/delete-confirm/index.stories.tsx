import * as React from 'react'
import * as Sb from '../../stories/storybook'
import DeleteConfirm from '.'

const load = () => {
  Sb.storiesOf('Settings', module).add('DeleteConfirm', () => (
    <DeleteConfirm
      onDeleteForever={Sb.action('onDeleteForever')}
      onCancel={Sb.action('onCancel')}
      username={'chris'}
      allowDeleteForever={true}
      setAllowDeleteAccount={Sb.action('setAllowDeleteAccount')}
    />
  ))
}

export default load
