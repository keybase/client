import * as React from 'react'
import * as Sb from '../stories/storybook'

import RichButton from './rich-button'

const Kb = {
  RichButton,
}

const load = () => {
  Sb.storiesOf('Common/RichButton', module).add('Basic', () => (
    <Kb.RichButton
      onClick={Sb.action('onClick')}
      icon="icon-bitcoin-logo-64"
      title="Friends, family, or squad"
      description="A small group of people, with no initial need for channels."
    />
  ))
}

export default load
