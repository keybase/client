// @flow
import React from 'react'
import * as Sb from '../../stories/storybook'
import * as Types from '../../constants/types/fs'
import {commonProvider} from '../common/index.stories'
import {provider as conversationListProvider} from '../../chat/conversation-list/index.stories'
import SendAttachmentToChat from '.'

export const provider = Sb.createPropProviderWithCommon({
  ...conversationListProvider,
  ...commonProvider,
})

const common = {
  onCancel: Sb.action('onCancel'),
  send: Sb.action('send'),
}

const load = () =>
  Sb.storiesOf('Files/SendAttachmentToChat', module)
    .addDecorator(provider)
    .add('no conversation', () => (
      <SendAttachmentToChat
        {...common}
        path={Types.stringToPath('/keybase/team/kbkbfstest/banana-bread-has-a-super-long-name.txt')}
      />
    ))

export default load
