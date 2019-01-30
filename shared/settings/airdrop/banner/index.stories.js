// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Banner from '.'

const props = {
  onCancel: Sb.action('onCancel'),
  onCheckQualify: Sb.action('onCheckQualify'),
  show: true,
}

const load = () => {
  Sb.storiesOf('Settings', module)
    .add('AirdropBanner', () => <Banner {...props} />)
    .add('AirdropBannerHidden', () => <Banner {...props} show={false} />)
}

export default load
