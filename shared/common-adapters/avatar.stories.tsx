import Avatar, {AvatarSize} from './avatar'
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Text from './text'
import Box from './box'
import {globalStyles} from '../styles'

const sizes: Array<AvatarSize> = [128, 96, 64, 48, 32, 16]
const provider = Sb.createPropProviderWithCommon(
  Sb.PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Avatar', () =>
      sizes.map(size => {
        const commonProps = {
          onClick: Sb.action('Avatar clicked'),
          showFollowingStatus: true,
          size: size,
          style: avatarStyle,
          username: 'nofollow-following',
        }
        return (
          <Box key={size}>
            <Text type="Body">{size}</Text>
            <Box style={{...globalStyles.flexBoxRow, flexWrap: 'wrap'}}>
              <Avatar {...commonProps} />
              <Avatar {...commonProps} borderColor="blue" />
              <Avatar {...commonProps} username="following" />
              <Avatar {...commonProps} username="following" showFollowingStatus={false} />
              <Avatar {...commonProps} username="followers" />
              <Avatar {...commonProps} username="both" />
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
