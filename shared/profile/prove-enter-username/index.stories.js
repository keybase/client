// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import {Box} from '../../common-adapters'
import {action, storiesOf} from '../../stories/storybook'
import Render from '.'

const props = {
  canContinue: true,
  errorCode: null,
  errorText: null,
  onCancel: () => action('onCancel'),
  onContinue: () => action('onContinue'),
  onUsernameChange: username => action('onUsernameChange'),
  username: 'chris',
}

const ProveEnterUsername = props => (
  <Box style={{display: 'flex', height: 580, minWidth: Styles.isMobile ? undefined : 640}}>
    <Render {...props} />
  </Box>
)

const load = () => {
  storiesOf('Profile/EnterUsername', module)
    .add('Twitter', () => <ProveEnterUsername {...props} platform="twitter" />)
    .add('Twitter error', () => (
      <ProveEnterUsername {...props} platform="twitter" errorText="Something went wrong" />
    ))
    .add('Reddit', () => <ProveEnterUsername {...props} platform="reddit" />)
    .add('Facebook', () => <ProveEnterUsername {...props} platform="facebook" />)
    .add('GitHub', () => <ProveEnterUsername {...props} platform="github" />)
    .add('Hacker News', () => <ProveEnterUsername {...props} platform="hackernews" />)
    .add('Bitcoin', () => <ProveEnterUsername {...props} platform="btc" />)
    .add('Bitcoin Disabled', () => <ProveEnterUsername {...props} platform="btc" canContinue={false} />)
    .add('DNS', () => <ProveEnterUsername {...props} platform="dns" />)
    .add('Website', () => <ProveEnterUsername {...props} platform="http" />)
    .add('Zcash', () => <ProveEnterUsername {...props} platform="zcash" />)
}

export default load
