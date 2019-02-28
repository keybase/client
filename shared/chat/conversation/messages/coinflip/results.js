// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type Props = {|
  result: RPCChatTypes.UICoinFlipResult,
|}
const CoinFlipResult = (props: Props) => {
  switch (props.result.typ) {
    case RPCChatTypes.chatUiUICoinFlipResultTyp.shuffle:
      return <CoinFlipResultShuffle shuffle={props.result.shuffle} />
    case RPCChatTypes.chatUiUICoinFlipResultTyp.deck:
      return <CoinFlipResultDeck deck={props.result.deck} />
    case RPCChatTypes.chatUiUICoinFlipResultTyp.hands:
      return <CoinFlipResultHands hands={props.result.hands} />
    case RPCChatTypes.chatUiUICoinFlipResultTyp.coin:
      return <CoinFlipResultCoin coin={props.result.coin} />
    default:
      return <CoinFlipResultNumber number={props.result.number} />
  }
}

const cards = [
  {suit: 'spades', value: '2'},
  {suit: 'spades', value: '3'},
  {suit: 'spades', value: '4'},
  {suit: 'spades', value: '5'},
  {suit: 'spades', value: '6'},
  {suit: 'spades', value: '7'},
  {suit: 'spades', value: '8'},
  {suit: 'spades', value: '9'},
  {suit: 'spades', value: '10'},
  {suit: 'spades', value: 'J'},
  {suit: 'spades', value: 'Q'},
  {suit: 'spades', value: 'K'},
  {suit: 'spades', value: 'A'},
  {suit: 'clubs', value: '2'},
  {suit: 'clubs', value: '3'},
  {suit: 'clubs', value: '4'},
  {suit: 'clubs', value: '5'},
  {suit: 'clubs', value: '6'},
  {suit: 'clubs', value: '7'},
  {suit: 'clubs', value: '8'},
  {suit: 'clubs', value: '9'},
  {suit: 'clubs', value: '10'},
  {suit: 'clubs', value: 'J'},
  {suit: 'clubs', value: 'Q'},
  {suit: 'clubs', value: 'K'},
  {suit: 'clubs', value: 'A'},
  {suit: 'diamonds', value: '2'},
  {suit: 'diamonds', value: '3'},
  {suit: 'diamonds', value: '4'},
  {suit: 'diamonds', value: '5'},
  {suit: 'diamonds', value: '6'},
  {suit: 'diamonds', value: '7'},
  {suit: 'diamonds', value: '8'},
  {suit: 'diamonds', value: '9'},
  {suit: 'diamonds', value: '10'},
  {suit: 'diamonds', value: 'J'},
  {suit: 'diamonds', value: 'Q'},
  {suit: 'diamonds', value: 'K'},
  {suit: 'diamonds', value: 'A'},
  {suit: 'hearts', value: '2'},
  {suit: 'hearts', value: '3'},
  {suit: 'hearts', value: '4'},
  {suit: 'hearts', value: '5'},
  {suit: 'hearts', value: '6'},
  {suit: 'hearts', value: '7'},
  {suit: 'hearts', value: '8'},
  {suit: 'hearts', value: '9'},
  {suit: 'hearts', value: '10'},
  {suit: 'hearts', value: 'J'},
  {suit: 'hearts', value: 'Q'},
  {suit: 'hearts', value: 'K'},
  {suit: 'hearts', value: 'A'},
]

const suits = {
  clubs: {
    color: Styles.globalColors.black,
    icon: 'iconfont-bomb',
  },
  diamonds: {
    color: Styles.globalColors.red,
    icon: 'iconfont-star',
  },
  hearts: {
    color: Styles.globalColors.red,
    icon: 'iconfont-reacji-heart',
  },
  spades: {
    color: Styles.globalColors.black,
    icon: 'iconfont-hand-wave',
  },
}

type CardType = {|
  card: number,
|}
const Card = (props: CardType) => (
  <Kb.Box2 direction="vertical" centerChildren={true} gap="xtiny" style={styles.card}>
    <Kb.Box2 direction="horizontal">
      <Kb.Text type="Header" style={{color: suits[cards[props.card].suit].color}}>
        {props.card && cards[props.card].value}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal">
      <Kb.Icon type={suits[cards[props.card].suit].icon} color={suits[cards[props.card].suit].color} />
    </Kb.Box2>
  </Kb.Box2>
)

type DeckType = {|
  deck: ?Array<number>,
|}
const CoinFlipResultDeck = (props: DeckType) => (
  <Kb.Box2 direction="horizontal">
    {props.deck && props.deck.map(card => <Card key={card} card={card} />)}
  </Kb.Box2>
)

type CoinType = {|
  coin: ?boolean,
|}
const CoinFlipResultCoin = (props: CoinType) => (
  <Kb.Box2 direction="horizontal" style={styles.coin}>
    <Kb.Icon type={props.coin ? 'iconfont-emoji' : 'iconfont-leave'} />
  </Kb.Box2>
)

type HandType = {|
  hands: ?Array<RPCChatTypes.UICoinFlipHand>,
|}
const CoinFlipResultHands = (props: HandType) => (
  <Kb.Box2 direction="vertical">
    {props.hands &&
      props.hands.map(hand => (
        <Kb.Box2 direction="horizontal" key={hand.target}>
          <Kb.Box2 direction="horizontal">{hand.target}</Kb.Box2>
          <CoinFlipResultDeck deck={hand.hand} />
        </Kb.Box2>
      ))}
  </Kb.Box2>
)

type NumberType = {|
  number: ?string,
|}
const CoinFlipResultNumber = (props: NumberType) => (
  <Kb.Box2 direction="horizontal">
    <Kb.Text type="Header">{props.number}</Kb.Text>
  </Kb.Box2>
)

type ShuffleType = {|
  shuffle: ?Array<string>,
|}
const CoinFlipResultShuffle = (props: ShuffleType) => (
  <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny">
    {props.shuffle &&
      props.shuffle.slice(0, 5).map((item, i) => (
        <Kb.Box2 key={i} direction="horizontal" alignSelf="flex-start" centerChildren={true}>
          <Kb.Box2
            direction="vertical"
            centerChildren={true}
            alignItems="center"
            style={styles.listOrderContainer}
          >
            <Kb.Text
              center={true}
              type={i === 0 ? 'BodyBig' : 'BodyTiny'}
              style={Styles.collapseStyles([styles.listOrder, i === 0 && styles.listOrderFirst])}
            >
              {i + 1}
            </Kb.Text>
          </Kb.Box2>
          <Kb.Markdown
            allowFontScaling={true}
            styleOverride={
              i === 0
                ? {
                    paragraph: {
                      // These are Header's styles.
                      fontSize: Styles.isMobile ? 20 : 18,
                      fontWeight: '700',
                    },
                  }
                : undefined
            }
          >
            {item}
          </Kb.Markdown>
        </Kb.Box2>
      ))}
    {props.shuffle && props.shuffle.length > 5 && (
      <Kb.Box2 direction="horizontal" style={styles.listFullContainer}>
        <Kb.Text type="BodySmallSemibold" style={styles.listFull}>
          Full shuffle:{' '}
          <Kb.Text type="BodySmall" style={styles.listFull}>
            {props.shuffle && props.shuffle.join(', ')}
          </Kb.Text>
        </Kb.Text>
      </Kb.Box2>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  card: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    height: 56,
    marginRight: -4,
    width: 40,
  },
  coin: {
    borderRadius: 32,
    borderStyle: 'solid',
    borderWidth: 4,
    height: 32,
    width: 32,
  },
  listFull: {
    color: Styles.globalColors.black,
  },
  listFullContainer: {
    marginTop: Styles.globalMargins.tiny,
  },
  listOrder: {
    color: Styles.globalColors.black,
    height: 14,
    width: 14,
  },
  listOrderContainer: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
    width: 20,
  },
  listOrderFirst: {
    backgroundColor: Styles.globalColors.black,
    borderRadius: 2,
    color: Styles.globalColors.white,
    height: 18,
    width: 18,
  },
})

export default CoinFlipResult
