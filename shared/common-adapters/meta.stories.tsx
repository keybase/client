import * as React from 'react'
import {Box2} from './box'
import Meta from './meta'
import {storiesOf} from '../stories/storybook'
import {globalColors} from '../styles'

const load = () => {
  storiesOf('Common', module).add('Meta', () => (
    <Box2 direction="vertical" gap="small" gapStart={true}>
      <Meta title="one" backgroundColor={globalColors.red} />
      <Meta title="two" backgroundColor={globalColors.orange} color={globalColors.black} />
      <Meta title="three" backgroundColor={globalColors.blue} />
    </Box2>
  ))
}

export default load
