import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Banner from '.'

const props = {
  headerBody:
    'Starting March 1, Keybase will divide *50,000 XLM* (Stellar Lumens) among qualified Keybase users, every month',
  onCancel: Sb.action('onCancel'),
  onCheckQualify: Sb.action('onCheckQualify'),
  show: true,
  showSystemButtons: false,
}

const load = () => {
  Sb.storiesOf('Settings/AirdropBanner', module)
    .add('Normal', () => <Banner {...props} />)
    .add('Hidden', () => <Banner {...props} show={false} />)
}

export default load
