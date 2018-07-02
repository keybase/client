// @flow
/* eslint-disable sort-keys */
import React from 'react'
import I from 'immutable'
import moment from 'moment'
import {Box2, Text} from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
import {storiesOf, action} from '../../../../stories/storybook'
import * as PropProviders from '../../../../stories/prop-providers'
import Thread from '.'
import * as Message from '../../../../constants/chat2/message'
import HiddenString from '../../../../util/hidden-string'
import {formatTimeForMessages} from '../../../../util/timestamp'

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
  editingOrdinal: null,
  lastLoadMoreOrdinal: null,
  lastMessageIsOurs: false,
  listScrollDownCounter: 0,
  onFocusInput: action('onFocusInput'),
  onToggleInfoPanel: action('onToggleInfoPanel'),
}

class Rnd {
  _seed = 0
  constructor(seed) {
    this._seed = seed
  }

  next = () => {
    this._seed = (this._seed * 16807) % 2147483647
    return this._seed
  }
}

// prettier-ignore
const words = ['At', 'Et', 'Itaque', 'Nam', 'Nemo', 'Quis', 'Sed', 'Temporibus', 'Ut', 'a', 'ab', 'accusamus', 'accusantium', 'ad', 'alias', 'aliquam', 'aliquid', 'amet', 'animi', 'aperiam', 'architecto', 'asperiores', 'aspernatur', 'assumenda', 'atque', 'aut', 'autem', 'beatae', 'blanditiis', 'commodi', 'consectetur', 'consequatur', 'consequatur', 'consequatur', 'consequuntur', 'corporis', 'corrupti', 'culpa', 'cum', 'cumque', 'cupiditate', 'debitis', 'delectus', 'deleniti', 'deserunt', 'dicta', 'dignissimos', 'distinctio', 'dolor', 'dolore', 'dolorem', 'doloremque', 'dolores', 'doloribus', 'dolorum', 'ducimus', 'ea', 'eaque', 'earum', 'eius', 'eligendi', 'enim', 'eos', 'eos', 'error', 'esse', 'est', 'est', 'et', 'eum', 'eveniet', 'ex', 'excepturi', 'exercitationem', 'expedita', 'explicabo', 'facere', 'facilis', 'fuga', 'fugiat', 'fugit', 'harum', 'hic', 'id', 'id', 'illo', 'illum', 'impedit', 'in', 'inventore', 'ipsa', 'ipsam', 'ipsum', 'iste', 'iure', 'iusto', 'labore', 'laboriosam', 'laborum', 'laudantium', 'libero', 'magnam', 'magni', 'maiores', 'maxime', 'minima', 'minus', 'modi', 'molestiae', 'molestias', 'mollitia', 'natus', 'necessitatibus', 'neque', 'nesciunt', 'nihil', 'nisi', 'nobis', 'non-numquam', 'non-provident', 'non-recusandae', 'nostrum', 'nulla', 'obcaecati', 'odio', 'odit', 'officia', 'officiis', 'omnis', 'optio', 'pariatur', 'perferendis', 'perspiciatis', 'placeat', 'porro', 'possimus', 'praesentium', 'quae', 'quaerat', 'quam', 'quas', 'quasi', 'qui', 'quia', 'quibusdam', 'quidem', 'quis', 'quisquam', 'quo', 'quod', 'quos', 'ratione', 'reiciendis', 'rem', 'repellat', 'repellendus', 'reprehenderit', 'repudiandae', 'rerum', 'saepe', 'sapiente', 'sed', 'sequi', 'similique', 'sint', 'sint', 'sit', 'sit', 'soluta', 'sunt', 'sunt', 'suscipit', 'tempora', 'tempore', 'tenetur', 'totam', 'ullam', 'unde', 'ut', 'vel', 'velit', 'velit', 'veniam', 'veritatis', 'vero', 'vitae', 'voluptas', 'voluptate', 'voluptatem', 'voluptatem', 'voluptatem', 'voluptates', 'voluptatibus', 'voluptatum']

// Generate timestamp in a range between start and end with some
// messagesThreshold number of consecutive messages with the same timestamp
const makeTimestampGen = (days: number = 7, threshold: number = 10) => {
  const r = new Rnd(1337)
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
      dayRange = r.next() % days + 1
      end.add(dayRange, 'days')

      const diff = end.diff(start)
      // Multiply the epoch time different by some floating point between [0, 1]
      const newDiff = diff * (r.next() / 2147483647)
      const newTimestamp = moment(start.valueOf() + newDiff)
      currentTimestamp = newTimestamp.valueOf()

      // Reset threashold and count
      messagesThreshold = r.next() % threshold + 1
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
  const r = new Rnd(1234)
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
    text: new HiddenString(String(o) + extra),
    timestamp: generateTimestamp(),
  })
  ordinalToMessageCache[o] = message
  return message
}

const provider = PropProviders.compose(
  PropProviders.Usernames(['max', 'cnojima', 'cdixon'], 'ayoubd'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both']),
  {
    Channel: p => ({name: p.name}),
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
    MessageFactory: ({ordinal, previous, measure}) => ({
      message: ordinalToMessage(ordinal),
      previous: ordinalToMessage(previous),
      isEditing: false,
      measure,
    }),
    MessagePopupText: p => ({
      attachTo: null,
      author: 'a',
      deviceName: 'a',
      deviceRevokedAt: 0,
      deviceType: 'mobile',
      onCopy: action('oncopy'),
      onDelete: null,
      onDeleteMessageHistory: null,
      onEdit: null,
      onHidden: action('onhidden'),
      onQuote: null,
      onReplyPrivately: null,
      onViewProfile: action('onviewprofile'),
      position: 'top left',
      showDivider: false,
      timestamp: 0,
      visible: false,
      yourMessage: false,
    }),
    WrapperTimestamp: p => {
      const {children, message, previous} = p
      // Want to mimick the timestamp logic in WrapperTimestamp
      const oldEnough = !!(
        previous &&
        previous.timestamp &&
        message.timestamp &&
        message.timestamp - previous.timestamp > Message.howLongBetweenTimestampsMs
      )
      return {
        children,
        message,
        orangeLineAbove: false,
        previous,
        timestamp: !previous || oldEnough ? formatTimeForMessages(message.timestamp) : null,
      }
    },
    WrapperAuthor: p => ({
      author: 'a',
      exploded: false,
      explodedBy: '',
      explodesAt: 0,
      exploding: false,
      failureDescription: '',
      includeHeader: false,
      innerClass: p.innerClass,
      isBroken: false,
      isEdited: false,
      isEditing: false,
      isExplodingUnreadable: false,
      isFollowing: false,
      isRevoked: false,
      isYou: false,
      measure: p.measure,
      message: p.message,
      messageFailed: false,
      messageKey: p.message.ordinal,
      messagePending: false,
      messageSent: true,
      onRetry: null,
      onEdit: null,
      onCancel: null,
      onAuthorClick: action('onAuthorclick'),
      orangeLineAbove: false,
      timestamp: '',
    }),
  }
)

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
    : action('onLoadMoreMessages')

  render() {
    return <Thread {...props} {...this.state} loadMoreMessages={this.onLoadMoreMessages} />
  }
}

const load = () => {
  storiesOf('Chat/Conversation/Thread', module)
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
