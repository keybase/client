// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import {Animated, Box, animated} from '.'

const load = () => {
  Sb.storiesOf('Common', module).add('Animated', () => (
    <Box>
      <Animated config={{delay: 1000}} from={{left: 0}} to={{left: 300}}>
        {({left}) => (
          <animated.div
            style={{
              backgroundColor: 'pink',
              height: 20,
              left,
              position: 'relative',
              width: 20,
            }}
          />
        )}
      </Animated>
    </Box>
  ))
}

export default load
