import React from 'react'
import * as Sb from '../stories/storybook'
import HeaderIcon from './header-icon'

const load = () => {
  Sb.storiesOf('Whats New', module)
    .add('Radio Icon - Nothing New', () => <HeaderIcon newFeatures={false} />)
    .add('Radio Icon - New Features', () => <HeaderIcon newFeatures={true} />)
}

export default load
