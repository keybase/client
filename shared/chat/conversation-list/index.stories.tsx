import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Sb from '../../stories/storybook'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import ChooseConversation from './choose-conversation'
import ConversationList, {RowItem} from './conversation-list'

const id = Types.stringToConversationIDKey
const s = Types.conversationIDKeyToString

const selectableSmalls = {
  small1: {
    isLocked: false,
    isMuted: false,
    participants: ['alice', 'bob'],
    showBold: false,
    teamname: '',
    usernameColor: Styles.globalColors.black,
  },
  small2: {
    isLocked: false,
    isMuted: true,
    participants: ['alice', 'bob', 'charlie'],
    showBold: false,
    teamname: '',
    usernameColor: Styles.globalColors.black,
  },
  small3: {
    isLocked: false,
    isMuted: false,
    participants: ['alice', 'bob', 'charlie', 'duh', 'eee', 'fff', 'ggg', 'hhh', 'iii', 'jjj'],
    showBold: false,
    teamname: '',
    usernameColor: Styles.globalColors.black,
  },
}

const selectableBigs = {
  bigA1: {channelname: 'samoyed', teamname: 'we_rate_dogs'},
  bigA2: {channelname: 'golden', teamname: 'we_rate_dogs'},
  bigA3: {channelname: 'husky', teamname: 'we_rate_dogs_and_we_have_loooooong_name'},
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

const smallProvider = (props: {conversationIDKey: Types.ConversationIDKey}) => ({
  ...(selectableSmalls[s(props.conversationIDKey)] || {}),
  ...props,
})

const bigProvider = (props: {conversationIDKey: Types.ConversationIDKey}) => ({
  ...(selectableBigs[s(props.conversationIDKey)] || {}),
  ...props,
})

const getRows = (numShown?: number, upstreamOnSelect?: () => void): Array<RowItem> => {
  const sbOnSelect = Sb.action('onSelect')
  const onSelectConversation = (...args: Array<any>) => {
    upstreamOnSelect && upstreamOnSelect()
    sbOnSelect(args)
  }
  const rows = [
    {conversationIDKey: id('small1'), isSelected: false, onSelectConversation, type: 'small'},
    {conversationIDKey: id('small2'), isSelected: false, onSelectConversation, type: 'small'},
    {conversationIDKey: id('small3'), isSelected: false, onSelectConversation, type: 'small'},
    {conversationIDKey: id('bigA1'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigA2'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigA3'), isSelected: false, onSelectConversation, type: 'big'},
    {conversationIDKey: id('bigA4'), isSelected: false, onSelectConversation, type: 'big'},
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
  ] as Array<RowItem>
}

const actions = {
  onBack: Sb.action('onBack'),
  onEnsureSelection: Sb.action('onEnsureSelection'),
  onSelectDown: Sb.action('onSelectDown'),
  onSelectUp: Sb.action('onSelectUp'),
}

const filter = {
  filter: '',
  filterFocusCount: 0,
  isLoading: false,
  onBack: Sb.action('onBack'),
  onBlur: Sb.action('onBlur'),
  onEnsureSelection: Sb.action('onEnsureSelection'),
  onFocus: Sb.action('onFocus'),
  onSelectDown: Sb.action('onSelectDown'),
  onSelectUp: Sb.action('onSelectUp'),
  onSetFilter: Sb.action('onSetFilter'),
  ...actions,
}

export const provider = {
  ChooseConversation: (props: {}) => ({...props, selectedText: 'Choose a conversation'}),
  ConversationList: ({onSelect}: {onSelect?: () => void}) => ({
    filter,
    rows: getRows(undefined, onSelect),
  }),
  SelectableBigTeamChannel: bigProvider,
  SelectableSmallTeam: smallProvider,
}

export default () =>
  Sb.storiesOf('Chat/ConversationList', module)
    .addDecorator(Sb.createPropProviderWithCommon(provider))
    .add('Collapsed - no filter', () => <ConversationList rows={getRows(8)} {...actions} />)
    .add('Collapsed', () => <ConversationList rows={getRows(8)} filter={filter} {...actions} />)
    .add('Expanded', () => <ConversationList rows={getRows()} filter={filter} {...actions} />)
    .add('ChooseConversation (Desktop)', () => (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
        <ChooseConversation
          selected={Constants.noConversationIDKey}
          selectedText="Choose a conversation ..."
          filter=""
          onSelect={Sb.action('onSelect')}
          onSetFilter={Sb.action('onSetFilter')}
        />
      </Kb.Box2>
    ))
