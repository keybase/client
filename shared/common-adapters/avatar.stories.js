// @flow
import Avatar from './avatar'
import React from 'react'
import Text from './text'
import Box from './box'
import {globalStyles} from '../styles'
import {storiesOf, action} from '../stories/storybook'

const sizes = [176, 112, 80, 64, 48, 40, 32, 24, 16, 12]

const load = () => {
  storiesOf('Avatar', module).add('Avatar', () =>
    sizes.map(size => {
      const commonProps = {
        following: false,
        followsYou: false,
        onClick: action('Avatar clicked'),
        size: size,
        style: avatarStyle,
        username: 'chris',
      }
      return (
        <Box key={size}>
          <Text type="Body">
            {size}
          </Text>
          <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>
            <Avatar {...commonProps} />
            <Avatar {...commonProps} borderColor="blue" />
            <Avatar {...commonProps} following={true} />
            <Avatar {...commonProps} followsYou={true} />
            <Avatar {...commonProps} following={true} followsYou={true} />
          </Box>
        </Box>
      )
    })
  )
}

const avatarStyle = {
  marginLeft: 10,
}

export default load
