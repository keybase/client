// @flow
import Avatar from './avatar'
import * as React from 'react'
import Text from './text'
import Box from './box'
import {globalStyles} from '../styles'
import {storiesOf, action} from '../stories/storybook'
import * as PropProviders from '../stories/prop-providers'

const sizes = [128, 96, 64, 48, 32, 16]
const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['chrisnojima'], ['chris'])
)

const load = () => {
  storiesOf('Common', module)
    .addDecorator(provider)
    .add('Avatar', () =>
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
              <Avatar {...commonProps} />
              <Avatar {...commonProps} />
              <Avatar {...commonProps} />
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
