import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/fs'
import {DesktopSendToChatRender} from '.'

import {default as conversationList} from './conversation-list/index.stories'

const load = () =>
  Sb.storiesOf('Files/SendToChat/Attachment', module)
    .add('no conversation', () => (
      <DesktopSendToChatRender
        enabled={false}
        convName=""
        path={Types.stringToPath('/keybase/team/kbkbfstest/banana-bread-has-a-super-long-name.txt')}
        title="banana-bread-has-a-super-long-name.txt"
        setTitle={Sb.action('setTitle')}
        onSend={Sb.action('onSend')}
        onSelect={Sb.action('onSelect')}
        onCancel={Sb.action('onCancel')}
      />
    ))
    .add('selected', () => (
      <DesktopSendToChatRender
        enabled={true}
        convName="mikem"
        path={Types.stringToPath('/keybase/team/kbkbfstest/banana-bread-has-a-super-long-name.txt')}
        title="banana-bread-has-a-super-long-name.txt"
        setTitle={Sb.action('setTitle')}
        onSend={Sb.action('onSend')}
        onSelect={Sb.action('onSelect')}
        onCancel={Sb.action('onCancel')}
      />
    ))

export default () => [conversationList, load].forEach(l => l())
