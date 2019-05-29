import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import {ExplodingExplainerElement} from './index'

const common = {
  onCancel: Sb.action('onCancel'),
}

const load = () => {
  Sb.storiesOf('Chat/Conversation', module).add('Exploding Explainer', () => (
    <ExplodingExplainerElement {...common} />
  ))
}

export default load
