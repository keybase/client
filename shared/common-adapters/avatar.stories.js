// @flow
import Avatar from './avatar'
import * as React from 'react'
import Text from './text'
import Box from './box'
import {globalStyles} from '../styles'
import {storiesOf, action} from '../stories/storybook'

const sizes = [128, 96, 64, 48, 32, 16]

const load = () => {
  storiesOf('Common', module).add('Avatar', () =>
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
          <Text type="Body">{size}</Text>
          <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>
            <Avatar {...commonProps} />
            <Avatar {...commonProps} borderColor="blue" />
            <Avatar {...commonProps} following={true} />
            <Avatar {...commonProps} followsYou={true} />
            <Avatar {...commonProps} following={true} followsYou={true} />
            <Avatar {...commonProps} username={undefined} teamname={'keybase'} />
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
