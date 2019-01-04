// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/chat2'
import ChooseConversation from './choose-conversation'
import ConversationList from './conversation-list'
import type {OwnProps as SelectableSmallTeamContainerProps} from '../selectable-small-team-container'
import type {OwnProps as SelectableBigTeamChannelContainerProps} from '../selectable-big-team-channel-container'

const id = Types.stringToConversationIDKey
const s = Types.conversationIDKeyToString

const selectableSmalls = {
  small1: {
    isLocked: false,
    isMuted: false,
    participants: ['alice', 'bob'],
    showBold: false,
    teamname: '',
    usernameColor: Styles.globalColors.black_75,
  },
  small2: {
    isLocked: false,
    isMuted: true,
    participants: ['alice', 'bob', 'charlie'],
    showBold: false,
    teamname: '',
    usernameColor: Styles.globalColors.black_75,
  },
  small3: {
    isLocked: false,
    isMuted: false,
    participants: ['alice', 'bob', 'charlie', 'duh'],
    showBold: false,
    teamname: '',
    usernameColor: Styles.globalColors.black_75,
  },
}

const selectableBigs = {
  bigA1: {channelname: 'samoyed', teamname: 'we_rate_dogs'},
  bigA2: {channelname: 'golden', teamname: 'we_rate_dogs'},
  bigA3: {channelname: 'husky', teamname: 'we_rate_dogs'},
  bigA4: {channelname: 'this_is_a_super_long_channelname_situation', teamname: 'we_rate_dogs'},
  bigB1: {channelname: 'random1', teamname: 'slackers'},
  bigB2: {channelname: 'random2', teamname: 'slackers'},
  bigB3: {channelname: 'random3', teamname: 'slackers'},
  bigB4: {channelname: 'random4', teamname: 'slackers'},
  bigB5: {channelname: 'random5', teamname: 'slackers'},
  bigB6: {channelname: 'random6', teamname: 'slackers'},
  bigB7: {channelname: 'random7', teamname: 'slackers'},
  bigB8: {channelname: 'random8', teamname: 'slackers'},
  bigB9: {channelname: 'random9', teamname: 'slackers'},
}

const smallProvider = ({
  conversationIDKey,
  isSelected,
  onSelectConversation,
}: SelectableSmallTeamContainerProps) => ({
  ...(selectableSmalls[s(conversationIDKey)] || {}),
  isSelected,
  onSelectConversation,
})

const bigProvider = ({
  conversationIDKey,
  isSelected,
  onSelectConversation,
}: SelectableBigTeamChannelContainerProps) => ({
  ...(selectableBigs[s(conversationIDKey)] || {}),
  isSelected,
  onSelectConversation,
})

const getRows = (numShown, upstreamOnSelect) => {
  const sbOnSelect = Sb.action('onSelect')
  const onSelectConversation = function() {
    upstreamOnSelect && upstreamOnSelect()
    sbOnSelect.apply(this, arguments)
  }
  const rows = [
    {conversationIDKey: id('small1'), isSelected: false, onSelectConversation, type: 'small'},
    {conversationIDKey: id('small2'), isSelected: false, onSelectConversation, type: 'small'},
    {conversationIDKey: id('small3'), isSelected: false, onSelectConversation, type: 'small'},
    {conversationIDKey: id('bigA1'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigA2'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigA3'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB1'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB2'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB3'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB4'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB5'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB6'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB7'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB8'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigB9'), isSelected: false, onSelectConversation, type: 'big'},
  ]
  const num = numShown || rows.length
  return [
    ...rows.slice(0, num),
    {
      hiddenCount: rows.length - num,
      onClick: Sb.action('onClick'),
      type: 'more-less',
    },
  ]
}

const filter = {
  isLoading: false,
  filter: '',
  filterFocusCount: 0,
  onSetFilter: Sb.action('onSetFilter'),
  onSelectDown: Sb.action('onSelectDown'),
  onSelectUp: Sb.action('onSelectUp'),
  onEnsureSelection: Sb.action('onEnsureSelection'),
}
export const provider = {
  ConversationList: ({onSelect}: {onSelect?: () => void}) => ({
    rows: getRows(5, onSelect),
    filter,
  }),
  SelectableBigTeamChannel: bigProvider,
  SelectableSmallTeam: smallProvider,
}

export default () =>
  Sb.storiesOf('Chat/ConversationList', module)
    .addDecorator(Sb.createPropProviderWithCommon(provider))
    .add('Collapsed - no filter', () => <ConversationList rows={getRows(5)} />)
    .add('Collapsed', () => <ConversationList rows={getRows(5)} filter={filter} />)
    .add('Expanded', () => <ConversationList rows={getRows()} filter={filter} />)
    .add('ChooseConversation (Desktop)', () => (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
        <ChooseConversation dropdownButtonDefaultText="Choose a conversation ..." />
      </Kb.Box2>
    ))
