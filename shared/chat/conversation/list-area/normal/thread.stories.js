// @flow
/* eslint-disable sort-keys */
import * as React from 'react'
import * as Sb from '../../../../stories/storybook'
import I from 'immutable'
import moment from 'moment'
import * as Kb from '../../../../common-adapters'
import * as Types from '../../../../constants/types/chat2'
import {propProvider as ReactionsRowProvider} from '../../messages/reactions-row/index.stories'
import {propProvider as ReactButtonProvider} from '../../messages/react-button/index.stories'
import {propProvider as ReactionTooltipProvider} from '../../messages/reaction-tooltip/index.stories'
import {type OwnProps as ExplodingMetaOwnProps} from '../../messages/wrapper/exploding-meta/container'
import {type _Props as ExplodingMetaViewProps} from '../../messages/wrapper/exploding-meta/'
import Thread from '.'
import * as Message from '../../../../constants/chat2/message'
import HiddenString from '../../../../util/hidden-string'
import {connectAdvanced} from 'react-redux'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

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

const ordinalToMessage = (o, state) => {
  const m = state.ordinalToMessage[o]
  if (m && state.ordinalToMessageUpdate[o]) {
    return m.merge(state.ordinalToMessageUpdate[o])
  }
  return m
}

const provider = Sb.createPropProviderWithCommon({
  ...ReactButtonProvider,
  ...ReactionsRowProvider,
  ...ReactionTooltipProvider,
  Channel: p => ({name: p.name}),
  ExplodingMeta: (p: ExplodingMetaOwnProps, state: any): ExplodingMetaViewProps => {
    const message = ordinalToMessage(p.ordinal, state)
    // $FlowIssue - exploding is required
    return {
      exploded: message.exploded,
      explodesAt: message.explodingTime,
      exploding: message.exploding,
      messageKey: '',
      onClick: null,
      pending: false,
    }
  },
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
  TextMessage: (p, state: any) => {
    const message = ordinalToMessage(p.message.ordinal, state)
    return {
      isEditing: false,
      mentionsAt: null,
      mentionsChannel: null,
      mentionsChannelName: null,
      text: message.text.stringValue(),
      type: message.errorReason ? 'error' : p.message.submitState === null ? 'sent' : 'pending',
    }
  },
  UnfurlList: (p, state: any) => {
    const message = ordinalToMessage(p.ordinal, state)
    const _unfurls = message && message.type === 'text' ? message.unfurls : null
    const unfurls = _unfurls
      ? _unfurls
          .toList()
          .map(u => {
            return {
              isCollapsed: u.isCollapsed,
              onClose: Sb.action('onClose unfurl'),
              onCollapse: Sb.action('onCollapse'),
              unfurl: u.unfurl,
              url: u.url,
            }
          })
          .toArray()
      : []
    return {unfurls}
  },
  WrapperMessage: (p, state: any) => {
    const message = ordinalToMessage(p.ordinal, state)
    const previous = ordinalToMessage(p.previous, state)
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
      showUsername: message.author,
    }
  },
})

type State = {|
  messageToModifyOrdinal: string,
|}

class _Controller extends React.Component<{state: any, dispatch: any}, State> {
  componentDidMount() {
    this.props.dispatch({type: 'replace', keyPath: ['ordinalToMessage'], payload: {}})
    this.props.dispatch({type: 'replace', keyPath: ['ordinalToMessageUpdate'], payload: {}})
  }

  _ordinal = 0

  _createMessage = (opts: any) => {
    const o = this._ordinal++
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

    const ts = generateTimestamp()

    const message = Message.makeMessageText({
      author: `dino_${String(o)}`,
      exploded: false,
      exploding: !!opts.explodeDelay,
      explodingTime: opts.explodeDelay ? Date.now() + opts.explodeDelay : undefined,
      timestamp: ts,
      ordinal: Types.numberToOrdinal(o),
      text: new HiddenString(String(o) + extra),
      unfurls: opts.unfurls ? this._unfurlHelper(o, false) : undefined,
    })
    return message
  }

  _addMessages = (count: number, opts: any) => () => {
    const ordinalToMessage = new Array(count)
      .fill(0)
      .map(_ => this._createMessage(opts))
      .reduce(
        (acc, m) => ({
          ...acc,
          [Types.ordinalToNumber(m.ordinal)]: m,
        }),
        {}
      )

    this.props.dispatch({type: 'merge', keyPath: ['ordinalToMessage'], payload: ordinalToMessage})
    opts.explodeDelay &&
      Object.keys(ordinalToMessage).forEach(o => this._updateMessageToExploded(o, opts.explodeDelay))
  }

  onLoadMoreMessages = () => {}

  state = {
    messageToModifyOrdinal: '',
  }

  _updateMessageToExploded(ordinal, timeout) {
    setTimeout(() => {
      this.props.dispatch({
        keyPath: ['ordinalToMessageUpdate'],
        payload: {[ordinal]: {exploding: true, exploded: true, unfurls: I.Map()}},
        type: 'merge',
      })
    }, timeout)
  }

  // Seed will modify the output to be different
  _unfurlHelper = (seed: number, withImg: boolean) => {
    if (seed % 2 === 0) {
      return I.Map({
        wsj: {
          isCollapsed: false,
          unfurl: {
            generic: {
              description:
                'A surge in technology shares following Facebook’s latest earnings lifted U.S. stocks, helping major indexes trim some of their October declines following a punishing period for global investors.',
              favicon: {
                height: 20,
                isVideo: false,
                url: require('../../../../images/mock/wsj.jpg'),
                width: 20,
              },
              image: {height: 400, url: require('../../../../images/mock/wsj_image.jpg'), width: 900},
              onClose: Sb.action('onClose'),
              publishTime: 1542241021655,
              siteName: 'WSJ',
              isCollapsed: false,
              title: 'U.S. Stocks Jump as Tough Month Sets to Wrap',
              url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
            },
            unfurlType: RPCChatTypes.unfurlUnfurlType.generic,
          },
          unfurlMessageID: 0,
          url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
        },
      })
    } else {
      return I.Map({
        wsj: {
          isCollapsed: false,
          unfurl: {
            generic: {
              description:
                'Keybase Go Library, Client, Service, OS X, iOS, Android, Electron - keybase/client',
              favicon: {
                height: 20,
                isVideo: false,
                url: require('../../../../images/mock/github_fav.jpg'),
                width: 20,
              },
              media: withImg
                ? {
                    url: require('../../../../images/mock/github.jpg'),
                    height: 80,
                    width: 80,
                    isVideo: false,
                  }
                : undefined,
              onClose: Sb.action('onClose'),
              onCollapse: Sb.action('onCollapse'),
              showImageOnSide: true,
              siteName: 'GitHub',
              title: 'keybase/client',
              url: 'https://github.com/keybase/client"',
            },
            unfurlType: RPCChatTypes.unfurlUnfurlType.generic,
          },
          unfurlMessageID: 0,
          url: 'https://www.wsj.com/articles/global-stocks-rally-to-end-a-tough-month-1540976261',
        },
      })
    }
  }

  _makeExploding = () => {
    this.props.dispatch({
      keyPath: ['ordinalToMessageUpdate'],
      payload: {[this.state.messageToModifyOrdinal]: {exploding: true, explodingTime: Date.now() + 5e3}},
      type: 'merge',
    })
    this._updateMessageToExploded(this.state.messageToModifyOrdinal, 5e3)
  }

  _loadUnfurlImg = () => {
    const o = this.state.messageToModifyOrdinal
    this.props.dispatch({
      keyPath: ['ordinalToMessageUpdate'],
      payload: {[o]: {unfurls: this._unfurlHelper(parseInt(o), true)}},
      type: 'merge',
    })
  }

  render() {
    return (
      <Kb.Box2 direction={'vertical'} fullHeight={true}>
        <Kb.Box2 direction={'vertical'}>
          <Kb.Button type="Secondary" label="Add 10 More Messages" onClick={this._addMessages(10, {})} />
          <Kb.Button type="Secondary" label="Add 1 More Message" onClick={this._addMessages(1, {})} />
          <Kb.Button
            type="Secondary"
            label="Add 1 More Exploding Message"
            onClick={this._addMessages(1, {explodeDelay: 5e3})}
          />
          <Kb.Button
            type="Secondary"
            label="Add 1 Message With Unfurl"
            onClick={this._addMessages(1, {unfurls: true})}
          />
          <Kb.Divider />
          <Kb.Text type="Body">Modify Message</Kb.Text>
          <Kb.PlainInput
            placeholder="Ordinal"
            value={this.state.messageToModifyOrdinal}
            onChangeText={t => this.setState({messageToModifyOrdinal: t})}
          />
          <Kb.Button type="Secondary" label="Load Unfurl Image" onClick={this._loadUnfurlImg} />
          <Kb.Button type="Danger" label="Explode" onClick={this._makeExploding} />
        </Kb.Box2>

        <Thread
          {...props}
          messageOrdinals={I.List(
            Object.keys(this.props.state.ordinalToMessage || {}).map(v => Types.numberToOrdinal(parseInt(v)))
          )}
          loadMoreMessages={this.onLoadMoreMessages}
        />
      </Kb.Box2>
    )
  }
}

const Controller = connectAdvanced(dispatch => (state, ownProps) => ({state, dispatch, ...ownProps}))(
  _Controller
)

const load = () => {
  Sb.storiesOf('Chat/Conversation/Thread', module)
    .addDecorator(provider)
    .add('Thread View With Controller', () => <Controller />)
}

export default load
