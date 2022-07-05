import * as React from 'react'
import {Badge, Box, Box2, Text} from '.'
import * as Sb from '../stories/storybook'
import {isMobile} from '../styles'

const numbers = [3, 77, 108, 4536, 23876, 1000000000]

function getDigits(n: number) {
  return n.toString().length
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Badge', () =>
      numbers.map(number => (
        <Box2
          gap="small"
          direction={isMobile ? 'vertical' : 'horizontal'}
          gapStart={true}
          gapEnd={true}
          fullWidth={false}
          key={number}
          style={{alignItems: 'center'}}
        >
          <Text type="Header">{getDigits(number)} digit number:</Text>
          <Box>
            <Badge badgeNumber={number} />
          </Box>
        </Box2>
      ))
    )
}

export default load
