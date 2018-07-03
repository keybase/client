// @flow
import * as React from 'react'
import DeleteConfirm from '.'
import * as PropProviders from '../../stories/prop-providers'
import {action, storiesOf, createPropProvider} from '../../stories/storybook'

const provider = createPropProvider(PropProviders.Usernames(), PropProviders.Avatar())

const load = () => {
  storiesOf('Settings', module)
    .addDecorator(provider)
    .add('DeleteConfirm', () => (
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
