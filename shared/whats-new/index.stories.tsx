import React from 'react'
import * as Sb from '../stories/storybook'
import HeaderIcon from './header-icon'
import NewFeature from './new-feature'

const load = () => {
  Sb.storiesOf('Whats New', module)
    .add('Radio Icon - Nothing New', () => <HeaderIcon newFeatures={false} />)
    .add('Radio Icon - New Features', () => <HeaderIcon newFeatures={true} />)
    .add('New Feature - Seen - Text Only', () => <NewFeature seen={true} text="hey" />)
}

export default load
