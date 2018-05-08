// @flow
import * as React from 'react'
import {storiesOf} from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import AssetInput from '.'

const load = () => {
  storiesOf('Wallets/SendForm/Asset input', module)
    .addDecorator(story => (
      <Box style={{boxSizing: 'content-box', maxWidth: 360, padding: 20}}>{story()}</Box>
    ))
    .add('Basic', () => <AssetInput />)
}

export default load
