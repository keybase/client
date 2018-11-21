// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Chat from '.'
import {Box} from '../../common-adapters/index'

const props = {
  whitelist: ['amazon.com', 'wsj.com', 'nytimes.com', 'keybase.io', 'google.com', 'twitter.com'],
  onSave: Sb.action('onSave'),
  onWhitelistRemove: Sb.action('onWhitelistRemoge'),
}

const load = () => {
  Sb.storiesOf('Settings/Chat', module)
    .addDecorator(story => <Box style={{padding: 5}}>{story()}</Box>)
    .add('Default', () => <Chat {...props} />)
}

export default load
