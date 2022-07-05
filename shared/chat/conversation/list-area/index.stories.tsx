/* eslint-disable sort-keys */
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Button, ButtonBar, Box2, Text} from '../../../common-adapters'
import * as Types from '../../../constants/types/chat2'
import {propProvider as ReactionsRowProvider} from '../messages/reactions-row/index.stories'
import {propProvider as ReactButtonProvider} from '../messages/react-button/index.stories'
import {propProvider as ReactionTooltipProvider} from '../messages/reaction-tooltip/index.stories'
import {OwnProps as ExplodingMetaOwnProps} from '../messages/wrapper/exploding-meta/container'
import {Props as ExplodingMetaViewProps} from '../messages/wrapper/exploding-meta'
import Thread from '.'
import * as Message from '../../../constants/chat2/message'
import HiddenString from '../../../util/hidden-string'
import JumpToRecent from './jump-to-recent'
import SpecialTopMessage from '../messages/special-top-message'
import * as Constants from '../../../constants/chat2'
import * as dateFns from 'date-fns'

const firstOrdinal = 10000
const makeMoreOrdinals = (
  ordinals: Array<Types.Ordinal>,
  direction: 'append' | 'prepend',
  num = __STORYSHOT__ ? 1 : 100
): Array<Types.Ordinal> => {
  if (direction === 'prepend') {
    const oldStart = ordinals.length ? Types.ordinalToNumber(ordinals[0] as Types.Ordinal) : firstOrdinal
    const start = Math.max(0, oldStart - num)
    const end = oldStart
    const newOrdinals: Array<Types.Ordinal> = []
    for (let i = start; i < end; ++i) {
      newOrdinals.push(Types.numberToOrdinal(i))
    }
    return [...newOrdinals, ...ordinals]
  } else {
    const oldEnd = ordinals.length ? Types.ordinalToNumber(ordinals[ordinals.length - 1]) + 1 : firstOrdinal
    const start = oldEnd
    const end = oldEnd + num
    const newOrdinals: Array<Types.Ordinal> = []
    for (let i = start; i < end; ++i) {
      newOrdinals.push(Types.numberToOrdinal(i))
    }
    return [...ordinals, ...newOrdinals]
  }
}

const props = {
  copyToClipboard: Sb.action('copyToClipboard'),
  editingOrdinal: undefined,
  lastLoadMoreOrdinal: undefined,
  lastMessageIsOurs: false,
  onFocusInput: Sb.action('onFocusInput'),
  scrollListDownCounter: 0,
  scrollListToBottomCounter: 0,
  scrollListUpCounter: 0,
}

// prettier-ignore
const words = ['At', 'Et', 'Itaque', 'Nam', 'Nemo', 'Quis', 'Sed', 'Temporibus', 'Ut', 'a', 'ab', 'accusamus', 'accusantium', 'ad', 'alias', 'aliquam', 'aliquid', 'amet', 'animi', 'aperiam', 'architecto', 'asperiores', 'aspernatur', 'assumenda', 'atque', 'aut', 'autem', 'beatae', 'blanditiis', 'commodi', 'consectetur', 'consequatur', 'consequatur', 'consequatur', 'consequuntur', 'corporis', 'corrupti', 'culpa', 'cum', 'cumque', 'cupiditate', 'debitis', 'delectus', 'deleniti', 'deserunt', 'dicta', 'dignissimos', 'distinctio', 'dolor', 'dolore', 'dolorem', 'doloremque', 'dolores', 'doloribus', 'dolorum', 'ducimus', 'ea', 'eaque', 'earum', 'eius', 'eligendi', 'enim', 'eos', 'eos', 'error', 'esse', 'est', 'est', 'et', 'eum', 'eveniet', 'ex', 'excepturi', 'exercitationem', 'expedita', 'explicabo', 'facere', 'facilis', 'fuga', 'fugiat', 'fugit', 'harum', 'hic', 'id', 'id', 'illo', 'illum', 'impedit', 'in', 'inventore', 'ipsa', 'ipsam', 'ipsum', 'iste', 'iure', 'iusto', 'labore', 'laboriosam', 'laborum', 'laudantium', 'libero', 'magnam', 'magni', 'maiores', 'maxime', 'minima', 'minus', 'modi', 'molestiae', 'molestias', 'mollitia', 'natus', 'necessitatibus', 'neque', 'nesciunt', 'nihil', 'nisi', 'nobis', 'non-numquam', 'non-provident', 'non-recusandae', 'nostrum', 'nulla', 'obcaecati', 'odio', 'odit', 'officia', 'officiis', 'omnis', 'optio', 'pariatur', 'perferendis', 'perspiciatis', 'placeat', 'porro', 'possimus', 'praesentium', 'quae', 'quaerat', 'quam', 'quas', 'quasi', 'qui', 'quia', 'quibusdam', 'quidem', 'quis', 'quisquam', 'quo', 'quod', 'quos', 'ratione', 'reiciendis', 'rem', 'repellat', 'repellendus', 'reprehenderit', 'repudiandae', 'rerum', 'saepe', 'sapiente', 'sed', 'sequi', 'similique', 'sint', 'sint', 'sit', 'sit', 'soluta', 'sunt', 'sunt', 'suscipit', 'tempora', 'tempore', 'tenetur', 'totam', 'ullam', 'unde', 'ut', 'vel', 'velit', 'velit', 'veniam', 'veritatis', 'vero', 'vitae', 'voluptas', 'voluptate', 'voluptatem', 'voluptatem', 'voluptatem', 'voluptates', 'voluptatibus', 'voluptatum']

// Generate timestamp in a range between start and end with some
// messagesThreshold number of consecutive messages with the same timestamp
const makeTimestampGen = (days: number = 7, threshold: number = 10) => {
  const r = new Sb.Rnd(1337)

  let messagesThreshold: number = 0
  let generatedCount: number = 0
  let currentTimestamp: number = 0

  let dayRange: number = 0
  let start = new Date(2018, 0, 0)
  let end = new Date(2018, 0, 0)

  return (): number => {
    // Initialize or reset because threshold was crossed
    if (currentTimestamp === 0 || generatedCount > messagesThreshold) {
      // Move the start day up by the previous number of days to avoid overlap
      start = dateFns.addDays(start, dayRange)
      // Get a new date range for random timestamps
      dayRange = (r.next() % days) + 1
      end = dateFns.addDays(end, dayRange)

      const diff = dateFns.differenceInMilliseconds(end, start)
      // Multiply the epoch time different by some floating point between [0, 1]
      const newDiff = diff * (r.next() / 2147483647)
      const newTimestamp = dateFns.getMilliseconds(dateFns.addMilliseconds(start, newDiff))
      currentTimestamp = newTimestamp.valueOf()

      // Reset threashold and count
      messagesThreshold = (r.next() % threshold) + 1
      generatedCount = 1

      return currentTimestamp
    }

    if (generatedCount <= messagesThreshold) {
      generatedCount++
    }

    return currentTimestamp
  }
}

const generateTimestamp = makeTimestampGen()

const ordinalToMessageCache: {[key: number]: Types.Message} = {}
const ordinalToMessage = (o: Types.Ordinal) => {
  if (ordinalToMessageCache[o]) {
    return ordinalToMessageCache[o]
  }
  const r = new Sb.Rnd(1234)
  for (var i = 0; i < o; ++i) {
    r.next()
  }

  const offset = r.next()
  const loops = __STORYSHOT__ ? 1 : r.next() % 100

  let extra = ''
  for (var j = 0; j < loops; ++j) {
    const newline = r.next() % 20
    extra += newline === 0 ? '\n' : ' ' + words[(j + offset) % words.length]
  }

  const message = Message.makeMessageText({
    ordinal: o,
    text: new HiddenString(String(o) + extra),
    timestamp: generateTimestamp(),
  })
  ordinalToMessageCache[o] = message
  return message
}

const provider = Sb.createPropProviderWithCommon({
  ...ReactButtonProvider,
  ...ReactionsRowProvider,
  ...ReactionTooltipProvider,
  Channel: p => ({name: p.name}),
  ExplodingMeta: (_: ExplodingMetaOwnProps): ExplodingMetaViewProps => ({
    // no exploding messages here
    exploded: false,
    explodesAt: 0,
    isParentHighlighted: false,
    messageKey: '',
    onClick: undefined,
    pending: false,
  }),
  Mention: p => ({username: p.username}),
  BottomMessage: () => ({
    showResetParticipants: null,
    showSuperseded: null,
    measure: null,
  }),
  SpecialTopMessage: () => ({
    conversationIDKey: Constants.pendingErrorConversationIDKey,
    pendingState: 'error',
  }),
  TopMessage: p => ({
    conversationIDKey: p.conversationIDKey,
    hasOlderResetConversation: false,
    showRetentionNotice: false,
    loadMoreType: 'moreToLoad',
    showTeamOffer: false,
    measure: p.measure,
  }),
  MessagePopupText: () => ({
    attachTo: undefined,
    author: 'a',
    deviceName: 'a',
    deviceRevokedAt: 0,
    deviceType: 'mobile',
    onCopy: Sb.action('oncopy'),
    onDelete: null,
    onDeleteMessageHistory: null,
    onEdit: null,
    onHidden: Sb.action('onhidden'),
    onQuote: null,
    onReplyPrivately: null,
    onViewProfile: Sb.action('onviewprofile'),
    position: 'top left',
    showDivider: false,
    timestamp: 0,
    visible: false,
    yourMessage: false,
  }),
  TextMessage: p => {
    return {
      isEditing: false,
      mentionsAt: null,
      mentionsChannel: null,
      mentionsChannelName: null,
      text: p.message.text.stringValue(),
      type: p.message.errorReason ? 'error' : p.message.submitState === null ? 'sent' : 'pending',
    }
  },
  WrapperMessage: p => {
    const message = ordinalToMessage(p.ordinal)
    const previous = ordinalToMessage(p.previous)
    return {
      conversationIDKey: p.conversationIDKey,
      exploded: (message.type === 'attachment' || message.type === 'text') && message.exploded,
      failureDescription: '',
      hasUnfurlPrompts: false,
      isRevoked: (message.type === 'text' || message.type === 'attachment') && !!message.deviceRevokedAt,
      measure: null,
      message: message,
      onAuthorClick: Sb.action('onAuthorClick'),
      onCancel: Sb.action('onCancel'),
      onEdit: Sb.action('onEdit'),
      onRetry: Sb.action('onRetry'),
      orangeLineAbove: false,
      previous,
      shouldShowPopup: false,
      showSendIndicator: false,
      showUsername: false,
    }
  },
})

const loadMore = Sb.action('onLoadMoreMessages')

type Props = {}

type State = {
  conversationIDKey: Types.ConversationIDKey
  loadMoreEnabled: boolean
  messageInjectionEnabled: boolean
  messageOrdinals: Array<Types.Ordinal>
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
}

class ThreadWrapper extends React.Component<Props, State> {
  _injectMessagesIntervalID?: ReturnType<typeof setTimeout>
  _loadMoreTimeoutID?: ReturnType<typeof setTimeout>
  _loadConvoTimeoutID?: ReturnType<typeof setTimeout>

  constructor(props: Props) {
    super(props)
    this.state = {
      conversationIDKey: Types.stringToConversationIDKey('a'),
      loadMoreEnabled: false,
      messageInjectionEnabled: false,
      messageOrdinals: makeMoreOrdinals([], 'append'),
      scrollListDownCounter: 0,
      scrollListToBottomCounter: 0,
      scrollListUpCounter: 0,
    }
  }

  _changeIDKey = () => {
    this.setState(p => {
      const s = Types.conversationIDKeyToString(p.conversationIDKey)
      const conversationIDKey = Types.stringToConversationIDKey(s + 'a')
      const messageOrdinals = p.messageOrdinals
      this._loadConvoTimeoutID = setTimeout(() => {
        console.log('++++ Reloading messages')
        this.setState({messageOrdinals})
      }, 2000)
      return {conversationIDKey, messageOrdinals: []}
    })
  }

  _toggleInjectMessages = () => {
    if (this._injectMessagesIntervalID) {
      clearInterval(this._injectMessagesIntervalID)
      this._injectMessagesIntervalID = undefined
    } else {
      this._injectMessagesIntervalID = setInterval(() => {
        console.log('Appending more mock items +++++')
        this.setState(p => ({
          messageOrdinals: makeMoreOrdinals(p.messageOrdinals, 'append', Math.ceil(Math.random() * 5)),
        }))
      }, 5000)
    }
    this.setState({messageInjectionEnabled: !!this._injectMessagesIntervalID})
  }

  _toggleLoadMore = () => {
    this.setState(state => ({loadMoreEnabled: !state.loadMoreEnabled}))
  }

  _scrollDown = () => {
    this.setState(state => ({scrollListDownCounter: state.scrollListDownCounter + 1}))
  }

  _scrollUp = () => {
    this.setState(state => ({scrollListUpCounter: state.scrollListUpCounter + 1}))
  }

  componentWillUnmount() {
    this._injectMessagesIntervalID && clearInterval(this._injectMessagesIntervalID)
    this._loadMoreTimeoutID && clearTimeout(this._loadMoreTimeoutID)
  }

  onLoadMoreMessages = () => {
    if (this.state.loadMoreEnabled) {
      console.log('got onLoadMore, using mock delay')
      this._loadMoreTimeoutID = setTimeout(() => {
        console.log('++++ Prepending more mock items')
        this.setState(p => ({messageOrdinals: makeMoreOrdinals(p.messageOrdinals, 'prepend')}))
      }, 2000)
    } else {
      loadMore()
    }
  }

  render() {
    const injectLabel = this.state.messageInjectionEnabled
      ? 'Disable message injection'
      : 'Enable message injection'
    const loadMoreLabel = this.state.loadMoreEnabled ? 'Disable load more' : 'Enable load more'
    return (
      <>
        <ButtonBar direction="row" align="flex-start">
          <Button label={injectLabel} onClick={this._toggleInjectMessages} />
          <Button label={loadMoreLabel} onClick={this._toggleLoadMore} />
          <Button label="Change conversation ID" onClick={this._changeIDKey} />
          <Button label="Scroll up" onClick={this._scrollUp} />
          <Button label="Scroll down" onClick={this._scrollDown} />
        </ButtonBar>
        <Thread
          {...props}
          containsLatestMessage={true}
          conversationIDKey={this.state.conversationIDKey}
          markInitiallyLoadedThreadAsRead={Sb.action('markInitiallyLoadedThreadAsRead')}
          messageOrdinals={this.state.messageOrdinals}
          loadOlderMessages={this.onLoadMoreMessages}
          loadNewerMessages={this.onLoadMoreMessages}
          onJumpToRecent={Sb.action('jump to recent')}
          scrollListUpCounter={this.state.scrollListUpCounter}
          scrollListToBottomCounter={this.state.scrollListToBottomCounter}
          scrollListDownCounter={this.state.scrollListDownCounter}
        />
      </>
    )
  }
}

const providerTopMessage = Sb.createPropProviderWithCommon({
  SpecialTopMessage: () => ({
    conversationIDKey: Constants.pendingErrorConversationIDKey,
    hasOlderResetConversation: false,
    loadMoreType: 'noMoreToLoad',
    measure: null,
    pendingState: 'error',
    showRetentionNotice: false,
    showTeamOffer: false,
    createConversationDisallowedUsers: ['cjb', 'max'],
    createConversationErrorHeader: 'The following people cannot be added to the conversation:',
    createConversationErrorDescription:
      'Their contact restrictions prevent you from getting in touch. Contact them outside Keybase to proceed.',
  }),
  TopMessage: () => ({
    conversationIDKey: Constants.pendingErrorConversationIDKey,
    createConversationError: 'I AM ERROR',
    hasOlderResetConversation: false,
    loadMoreType: 'noMoreToLoad',
    measure: null,
    pendingState: 'error',
    showRetentionNotice: false,
    showTeamOffer: false,
  }),
})

const load = () => {
  Sb.storiesOf('Chat/Conversation/Thread', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {story()}
      </Box2>
    ))
    .add('Normal', () => <ThreadWrapper />)
    .add('Readme', () => (
      <Text type="Body">
        If you load Normal directly on start the fonts wont be loaded so it'll measure wrong
      </Text>
    ))
    .add('Jump to Recent', () => <JumpToRecent onClick={Sb.action('onClick')} />)

  Sb.storiesOf('Chat/Conversation/Thread', module)
    .addDecorator(providerTopMessage)
    .add('Error top bar', () => <SpecialTopMessage conversationIDKey="1" measure={null} />)
}

export default load
