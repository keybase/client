import React from 'react'
import * as Sb from '../../../stories/storybook'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as ChatTypes from '../../../constants/types/chat2'
import SendLinkToChat from '.'

export const provider = Sb.createPropProviderWithCommon({})

const common = {
  onCancel: Sb.action('onCancel'),
  onSent: Sb.action('onSent'),
  send: Sb.action('send'),
  sendLinkToChatState: Types.SendLinkToChatState.ReadyToSend,
} as const

const channels = [
  {
    channelname: 'aaabbbccclongnameblahblahblahblahfoiwehfioewuhf',
    convID: ChatTypes.stringToConversationIDKey('0'),
  },
  {channelname: 'aaa', convID: ChatTypes.stringToConversationIDKey('1')},
  {channelname: 'bbb', convID: ChatTypes.stringToConversationIDKey('2')},
  {channelname: 'ccc', convID: ChatTypes.stringToConversationIDKey('3')},
]

const makePathTextToCopy = (pathString: string) => `${Constants.escapePath(Types.stringToPath(pathString))} ` // append space

const load = () =>
  Sb.storiesOf('Files/SendToChat/Link', module)
    .addDecorator(provider)
    .add('no conversation', () => (
      <SendLinkToChat
        {...common}
        pathTextToCopy={makePathTextToCopy('/keybase/private')}
        conversation={{type: 'none'}}
      />
    ))
    .add('1:1 loading convID', () => (
      <SendLinkToChat
        {...common}
        send={undefined}
        pathTextToCopy={makePathTextToCopy('/keybase/private/songgao,songgao_test')}
        conversation={{name: 'songgao_test', type: 'person'}}
      />
    ))
    .add('1:1', () => (
      <SendLinkToChat
        {...common}
        pathTextToCopy={makePathTextToCopy('/keybase/private/songgao,songgao_test')}
        conversation={{name: 'songgao_test', type: 'person'}}
      />
    ))
    .add('group', () => (
      <SendLinkToChat
        {...common}
        pathTextToCopy={makePathTextToCopy('/keybase/private/songgao,songgao_test,meatball')}
        conversation={{name: 'songgao_test,meatball', type: 'group'}}
      />
    ))
    .add('group - long', () => (
      <SendLinkToChat
        {...common}
        pathTextToCopy={makePathTextToCopy('/keybase/private/songgao,songgao_test,meatball')}
        conversation={{
          name: 'songgao_test,meatball,abc,def,ghi,jkl,mno,pqr,stu,vwx,yz0,alice,bob,charlie',
          type: 'group',
        }}
      />
    ))
    .add('Small Team', () => (
      <SendLinkToChat
        {...common}
        pathTextToCopy={makePathTextToCopy('/keybase/team/kbkbfstest')}
        conversation={{name: 'kbkbfstest', type: 'small-team'}}
      />
    ))
    .add('Big Team', () => (
      <SendLinkToChat
        {...common}
        pathTextToCopy={makePathTextToCopy('/keybase/team/kbkbfstest')}
        conversation={{
          channels,
          name: 'kbkbfstest',
          selectChannel: Sb.action('selectChannel'),
          type: 'big-team',
        }}
      />
    ))
    .add('SendLinkToChat - Big Team - Selected', () => (
      <SendLinkToChat
        {...common}
        pathTextToCopy={makePathTextToCopy(
          '/keybase/team/kbkbfstest/blahblah/long-name/blah/woeifj/wioejfoiwej'
        )}
        conversation={{
          channels,
          name: 'kbkbfstest',
          selectChannel: Sb.action('selectChannel'),
          selectedChannel: channels[0],
          type: 'big-team',
        }}
      />
    ))

export default load
