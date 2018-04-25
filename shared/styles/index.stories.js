// @flow
import React from 'react'
import {Box, Text} from '../common-adapters'
import {storiesOf} from '../stories/storybook'
import {globalColors} from '../styles'

const load = () => {
  storiesOf('Styles', module).add('Colors', () => (
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
