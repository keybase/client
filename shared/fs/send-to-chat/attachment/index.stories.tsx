import React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Types from '../../../constants/types/fs'
import * as ChatConstants from '../../../constants/chat2'
import {commonProvider} from '../../common/index.stories'
import {provider as conversationListProvider} from '../../../chat/conversation-list/index.stories'
import SendAttachmentToChat from '.'

export const provider = Sb.createPropProviderWithCommon({
  ...conversationListProvider,
  ...commonProvider,
  ChooseConversationHOC: props => ({
    ...props,
    filter: '',
    onSelect: Sb.action('onSelect'),
    onSetFilter: Sb.action('onSetFilter'),
    selected: ChatConstants.noConversationIDKey,
    selectedText: 'Choose a conversation',
  }),
})

const common = {
  onCancel: Sb.action('onCancel'),
  onSetTitle: Sb.action('onSetTitle'),
  send: Sb.action('send'),
  sendAttachmentToChatState: Types.SendAttachmentToChatState.ReadyToSend,
}

const load = () =>
  Sb.storiesOf('Files/SendToChat/Attachment', module)
    .addDecorator(provider)
    .add('no conversation', () => (
      <SendAttachmentToChat
        {...common}
        path={Types.stringToPath('/keybase/team/kbkbfstest/banana-bread-has-a-super-long-name.txt')}
        title="banana-bread-has-a-super-long-name.txt"
      />
    ))

export default load
