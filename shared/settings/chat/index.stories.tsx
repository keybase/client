import * as React from 'react'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as Sb from '../../stories/storybook'
import Chat from '.'
import {Box} from '../../common-adapters/index'

const actions = {
  onRefresh: Sb.action('onRefresh'),
  onUnfurlSave: (mode: RPCChatTypes.UnfurlMode, whitelist: Array<string>) => {
    Sb.action('onUnfurlSave')(mode, whitelist)
  },
}

const props = {
  unfurlMode: RPCChatTypes.UnfurlMode.whitelisted,
  unfurlWhitelist: [
    'amazon.com',
    'wsj.com',
    'nytimes.com',
    'keybase.io',
    'google.com',
    'twitter.com',
    'keyba.se',
    'microsoft.com',
  ],
  ...actions,
}

const errorProps = {
  ...props,
  unfurlError: 'Unable to save link preview settings, please try again.',
}

const loadErrorProps = {
  unfurlError: 'Unable to load link preview settings, please try again.',
  ...actions,
}

const load = () => {
  Sb.storiesOf('Settings/Chat', module)
    .addDecorator(story => <Box style={{padding: 5}}>{story()}</Box>)
    .add('Default', () => <Chat {...props} />)
    .add('Error', () => <Chat {...errorProps} />)
    .add('Load Error', () => <Chat {...loadErrorProps} />)
}

export default load
