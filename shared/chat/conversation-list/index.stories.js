// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import ChooseConversation from './choose-conversation'
import ConversationList from './conversation-list'

const getRows = upstreamOnSelect => {
  const sbOnSelect = Sb.action('onSelect')
  const onSelect = function() {
    upstreamOnSelect && upstreamOnSelect()
    sbOnSelect.apply(this, arguments)
  }
  return [
    {
      name: 'deephouse',
      onSelect,
      type: 'small-team',
    },
    {
      name: 'floboucheron',
      onSelect,
      type: 'small-team',
    },
    {
      avatarUsernames: ['bar'],
      name: 'foo,bar',
      onSelect,
      type: 'group',
    },
    {
      avatarUsernames: ['foo', 'bar', 'abc', 'def', 'ghi', 'jkl', 'mno', 'pqr', 'stu', 'vwx', 'yz0'],
      name: 'foo,bar,abc,def,ghi,jkl,mno,pqr,stu,vwx,yz0',
      onSelect,
      type: 'group',
    },
    {onSelect, type: 'more'},
    {
      name: 'kbkbfstest',
      onSelect,
      type: 'big-team',
    },
    {
      name: 'bestcoast',
      onSelect,
      type: 'channel',
    },
    {
      name: 'nyc',
      onSelect,
      type: 'channel',
    },
    {
      name: 'kbkbfstest.test',
      onSelect,
      type: 'big-team',
    },
    ...Array.from(Array(20)).map((_, i) => ({
      name: `channel${i}`,
      onSelect,
      type: 'channel',
    })),
  ]
}

export const provider = {
  ConversationList: ({onSelect}: {onSelect?: () => void}) => ({
    hiddenCount: 2,
    rows: getRows(onSelect),
    toggleExpand: Sb.action('toggleExpand'),
  }),
}

export default () =>
  Sb.storiesOf('Chat/ConversationList', module)
    .addDecorator(Sb.createPropProviderWithCommon(provider))
    .add('Collapsed', () => (
      <ConversationList hiddenCount={2} rows={getRows()} toggleExpand={Sb.action('toggleExpand')} />
    ))
    .add('Expanded', () => (
      <ConversationList hiddenCount={0} rows={getRows()} toggleExpand={Sb.action('toggleExpand')} />
    ))
    .add('ChooseConversation (Desktop)', () => (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
        <ChooseConversation dropdownButtonDefaultText="Choose a conversation ..." />
      </Kb.Box2>
    ))
