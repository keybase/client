import * as React from 'react'
import * as Sb from '../stories/storybook'
import PushPrompt from './push-prompt.native'

const load = () => {
  Sb.storiesOf('App', module)
    .addDecorator(Sb.createPropProviderWithCommon({PushPrompt: () => ({})}))
    .add('PushPrompt', () => {
      return <PushPrompt />
    })
}

export default load
