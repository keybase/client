// @flow
import * as React from 'react'
import {action, storiesOf} from '../../stories/storybook'
import QRScan from './index.native'

const props = {
  onSubmitCode: action('onSubmitCode'),
  onOpenSettings: action('onOpenSettings'),
}

const load = () => {
  storiesOf('Wallets/QRScan', module).add('Scan', () => <QRScan {...props} />)
}

export default load
