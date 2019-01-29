// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import Airdrop from '.'
import qualify from './qualify/index.stories'

const props = {
  onCheckQualify: Sb.action('onCheckQualify'),
  signedUp: false,
}

const load = () => {
  Sb.storiesOf('Settings/Airdrop', module)
    .add('Participating', () => <Airdrop {...props} />)
    .add('Not Participating', () => <Airdrop {...props} signedUp={false} />)
  qualify()
}

export default load
