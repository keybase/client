// @flow
import * as React from 'react'
import {storiesOf} from '../../../stories/storybook'
import ChooseAsset from '.'

const load = () => {
  storiesOf('Wallets/SendForm/Choose asset', module).add('Basic', () => <ChooseAsset />)
}

export default load
