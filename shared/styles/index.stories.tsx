import * as React from 'react'
import * as Sb from '../stories/storybook'
import {Box, Text} from '../common-adapters'
import {globalColors} from '../styles'

const load = () => {
  Sb.storiesOf('Styles', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Colors', () => (
      <Box>
        {Object.keys(globalColors)
          .sort()
          .map(c => (
            <Box key={c}>
              <Text type="BodySmall">{`${c}: ${globalColors[c] || ''}`}</Text>
              <Box style={{backgroundColor: globalColors[c], height: 60, width: 60}} />
            </Box>
          ))}
      </Box>
    ))
}

export default load
