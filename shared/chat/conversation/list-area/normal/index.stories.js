// @flow
/* eslint-disable sort-keys */
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import I from 'immutable'
import moment from 'moment'
import {Box2, Text} from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
import {propProvider as ReactionsRowProvider} from '../../messages/reactions-row/index.stories'
import {propProvider as ReactButtonProvider} from '../../messages/react-button/index.stories'
import {propProvider as ReactionTooltipProvider} from '../../messages/reaction-tooltip/index.stories'
import {type OwnProps as ExplodingMetaOwnProps} from '../../messages/wrapper/exploding-meta/container'
import {type _Props as ExplodingMetaViewProps} from '../../messages/wrapper/exploding-meta/'
import Thread from '.'
import * as Message from '../../../../constants/chat2/message'
import HiddenString from '../../../../util/hidden-string'

// set this to true to play with messages coming in on a timer
const injectMessages = false && !__STORYSHOT__
// set this to true to play with loading more working
const enableLoadMore = false && !__STORYSHOT__
const ordinalAscending = true

let index = 1
const makeMoreOrdinals = (num = __STORYSHOT__ ? 10 : 100) => {
  const end = index + num
  const ordinals = []
  for (; index < end; ++index) {
    ordinals.push(Types.numberToOrdinal(ordinalAscending ? index : 9000 - index))
  }
  return ordinals
}
const messageOrdinals = I.List(makeMoreOrdinals())
const conversationIDKey = Types.stringToConversationIDKey('a')

const props = {
  conversationIDKey,
  copyToClipboard: Sb.action('copyToClipboard'),
  editingOrdinal: null,
  lastLoadMoreOrdinal: null,
  lastMessageIsOurs: false,
  onFocusInput: Sb.action('onFocusInput'),
  scrollListDownCounter: 0,
  scrollListUpCounter: 0,
}

// prettier-ignore
const words = ['At', 'Et', 'Itaque', 'Nam', 'Nemo', 'Quis', 'Sed', 'Temporibus', 'Ut', 'a', 'ab', 'accusamus', 'accusantium', 'ad', 'alias', 'aliquam', 'aliquid', 'amet', 'animi', 'aperiam', 'architecto', 'asperiores', 'aspernatur', 'assumenda', 'atque', 'aut', 'autem', 'beatae', 'blanditiis', 'commodi', 'consectetur', 'consequatur', 'consequatur', 'consequatur', 'consequuntur', 'corporis', 'corrupti', 'culpa', 'cum', 'cumque', 'cupiditate', 'debitis', 'delectus', 'deleniti', 'deserunt', 'dicta', 'dignissimos', 'distinctio', 'dolor', 'dolore', 'dolorem', 'doloremque', 'dolores', 'doloribus', 'dolorum', 'ducimus', 'ea', 'eaque', 'earum', 'eius', 'eligendi', 'enim', 'eos', 'eos', 'error', 'esse', 'est', 'est', 'et', 'eum', 'eveniet', 'ex', 'excepturi', 'exercitationem', 'expedita', 'explicabo', 'facere', 'facilis', 'fuga', 'fugiat', 'fugit', 'harum', 'hic', 'id', 'id', 'illo', 'illum', 'impedit', 'in', 'inventore', 'ipsa', 'ipsam', 'ipsum', 'iste', 'iure', 'iusto', 'labore', 'laboriosam', 'laborum', 'laudantium', 'libero', 'magnam', 'magni', 'maiores', 'maxime', 'minima', 'minus', 'modi', 'molestiae', 'molestias', 'mollitia', 'natus', 'necessitatibus', 'neque', 'nesciunt', 'nihil', 'nisi', 'nobis', 'non-numquam', 'non-provident', 'non-recusandae', 'nostrum', 'nulla', 'obcaecati', 'odio', 'odit', 'officia', 'officiis', 'omnis', 'optio', 'pariatur', 'perferendis', 'perspiciatis', 'placeat', 'porro', 'possimus', 'praesentium', 'quae', 'quaerat', 'quam', 'quas', 'quasi', 'qui', 'quia', 'quibusdam', 'quidem', 'quis', 'quisquam', 'quo', 'quod', 'quos', 'ratione', 'reiciendis', 'rem', 'repellat', 'repellendus', 'reprehenderit', 'repudiandae', 'rerum', 'saepe', 'sapiente', 'sed', 'sequi', 'similique', 'sint', 'sint', 'sit', 'sit', 'soluta', 'sunt', 'sunt', 'suscipit', 'tempora', 'tempore', 'tenetur', 'totam', 'ullam', 'unde', 'ut', 'vel', 'velit', 'velit', 'veniam', 'veritatis', 'vero', 'vitae', 'voluptas', 'voluptate', 'voluptatem', 'voluptatem', 'voluptatem', 'voluptates', 'voluptatibus', 'voluptatum']

// Generate timestamp in a range between start and end with some
// messagesThreshold number of consecutive messages with the same timestamp
const makeTimestampGen = (days: number = 7, threshold: number = 10) => {
  const r = new Sb.Rnd(1337)
  const origin = {year: 2018, month: 0, day: 0}

  let messagesThreshold: number = 0
  let generatedCount: number = 0
  let currentTimestamp: number = 0

  let dayRange: number = 0
  let start = moment(origin)
  let end = moment(origin)

  return (): number => {
    // Initialize or reset because threshold was crossed
    if (currentTimestamp === 0 || generatedCount > messagesThreshold) {
      // Move the start day up by the previous number of days to avoid overlap
      start.add(dayRange, 'days')
      // Get a new date range for random timestamps
      dayRange = (r.next() % days) + 1
      end.add(dayRange, 'days')

      const diff = end.diff(start)
      // Multiply the epoch time different by some floating point between [0, 1]
      const newDiff = diff * (r.next() / 2147483647)
      const newTimestamp = moment(start.valueOf() + newDiff)
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

const ordinalToMessageCache = {}
const ordinalToMessage = o => {
  if (ordinalToMessageCache[o]) {
    return ordinalToMessageCache[o]
  }
  const r = new Sb.Rnd(1234)
  for (var i = 0; i < o; ++i) {
    r.next()
  }

  const offset = r.next()
  const loops = r.next() % 100

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
  ExplodingMeta: (p: ExplodingMetaOwnProps): ExplodingMetaViewProps => ({
    // no exploding messages here
    exploded: false,
    explodesAt: 0,
    messageKey: '',
    onClick: null,
    pending: false,
  }),
  Mention: p => ({username: p.username}),
  BottomMessage: p => ({
    showResetParticipants: null,
    showSuperseded: null,
    measure: null,
  }),
  TopMessage: p => ({
    conversationIDKey,
    hasOlderResetConversation: false,
    showRetentionNotice: false,
    loadMoreType: 'moreToLoad',
    showTeamOffer: false,
    measure: p.measure,
  }),
  MessagePopupText: p => ({
    attachTo: null,
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
      conversationIDKey: message.conversationIDKey,
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

type Props = {}
type State = {|
  messageOrdinals: I.List<Types.Ordinal>,
|}
class ThreadWrapper extends React.Component<Props, State> {
  intervalID: IntervalID
  timeoutID: TimeoutID
  constructor(props) {
    super(props)
    this.state = {
      messageOrdinals: messageOrdinals,
    }

    if (injectMessages) {
      this.intervalID = setInterval(() => {
        console.log('Appending more mock items +++++')
        this.setState(p => ({
          messageOrdinals: p.messageOrdinals.push(...makeMoreOrdinals(Math.ceil(Math.random() * 5))),
        }))
      }, 5000)
    }
  }

  componentWillUnmount() {
    clearInterval(this.intervalID)
    clearTimeout(this.timeoutID)
  }

  onLoadMoreMessages = enableLoadMore
    ? () => {
        console.log('got onLoadMore, using mock delay')
        this.timeoutID = setTimeout(() => {
          console.log('++++ Prepending more mock items')
          this.setState(p => ({messageOrdinals: p.messageOrdinals.unshift(...makeMoreOrdinals())}))
        }, 2000)
      }
    : Sb.action('onLoadMoreMessages')

  render() {
    return <Thread {...props} {...this.state} loadMoreMessages={this.onLoadMoreMessages} />
  }
}

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
}

export default load
