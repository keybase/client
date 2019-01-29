// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Banner from '.'

const props = {
  onCheckQualify: Sb.action('onCheckQualify'),
}

const load = () => {
  Sb.storiesOf('Settings', module).add('AirdropBanner', () => <Banner {...props} />)
}

export default load
