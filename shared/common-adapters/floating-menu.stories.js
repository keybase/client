// @flow
import * as React from 'react'
import {FloatingMenu} from '.'
import {storiesOf, createPropProvider, action} from '../stories/storybook'
import * as PropProviders from '../stories/prop-providers'

const provider = createPropProvider(PropProviders.Common())

const items = [{title: 'one'}, {title: 'two'}, {title: '3'}, {title: 'four'}]

const load = () => {
  storiesOf('Common', module)
    .addDecorator(provider)
    .add('Floating Menu', () => (
      <FloatingMenu closeOnSelect={true} visible={true} items={items} onHidden={action('onHidden')} />
    ))
}

export default load
