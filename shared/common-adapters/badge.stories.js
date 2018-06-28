// @flow
import Badge from './badge'
import * as React from 'react'
import Box from './box'
import Text from './text'
import {storiesOf} from '../stories/storybook'

const numbers = [3, 77, 108, 4536, 23876, 1000000000]

function getDigits(n: number) {
  return n.toString().length
}

const load = () => {
  storiesOf('Common', module).add('Badge', () =>
    numbers.map(number => (
      <Box key={number}>
        <Text type="Body">{getDigits(number)} digit number:</Text>
        <Badge badgeNumber={number} badgeStyle={{width: 'auto'}} />
      </Box>
    ))
  )
}

export default load
