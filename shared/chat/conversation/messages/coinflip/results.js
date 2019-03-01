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

// The order here is important.
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
    icon: 'iconfont-club',
  },
  diamonds: {
    color: Styles.globalColors.red,
    icon: 'iconfont-diamond',
  },
  hearts: {
    color: Styles.globalColors.red,
    icon: 'iconfont-heart',
  },
  spades: {
    color: Styles.globalColors.black,
    icon: 'iconfont-spade',
  },
}

type CardType = {|
  card: number,
  hand?: boolean,
|}
const Card = (props: CardType) => (
  <Kb.Box2
    direction="vertical"
    centerChildren={true}
    style={Styles.collapseStyles([styles.card, !props.hand && styles.cardStacked])}
  >
    <Kb.Box2 direction="horizontal">
      <Kb.Text
        selectable={true}
        type={Styles.isMobile ? 'Body' : 'BodyBig'}
        style={{color: suits[cards[props.card].suit].color}}
      >
        {cards[props.card].value}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal">
      <Kb.Icon
        fontSize={12}
        type={suits[cards[props.card].suit].icon}
        color={suits[cards[props.card].suit].color}
      />
    </Kb.Box2>
  </Kb.Box2>
)

type DeckType = {|
  deck: ?Array<number>,
  hand?: boolean,
|}
const CoinFlipResultDeck = (props: DeckType) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([styles.cards, !props.hand && styles.cardsStacked])}
  >
    {props.deck && props.deck.map(card => <Card key={card} card={card} hand={props.hand} />)}
  </Kb.Box2>
)

type CoinType = {|
  coin: ?boolean,
|}
const CoinFlipResultCoin = (props: CoinType) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
    <Kb.Box2 direction="vertical" style={styles.coin} centerChildren={true}>
      <Kb.Icon type={props.coin ? 'icon-coin-heads-48-48' : 'icon-coin-tails-48-48'} />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" centerChildren={true}>
      <Kb.Text selectable={true} type="Header">
        {props.coin ? 'Heads!' : 'Tails!'}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

type HandType = {|
  hands: ?Array<RPCChatTypes.UICoinFlipHand>,
|}
const CoinFlipResultHands = (props: HandType) => (
  <Kb.Box2 direction="horizontal" fullWidth={true}>
    <Kb.Box2 direction="vertical" gap="tiny">
      {props.hands &&
        props.hands.map(hand => (
          <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'} fullWidth={true} key={hand.target}>
            <Kb.Box2
              alignItems="flex-start"
              direction={Styles.isMobile ? 'vertical' : 'horizontal'}
              style={styles.handTarget}
            >
              <Kb.Text selectable={true} type="BodyBig">
                {hand.target}
              </Kb.Text>
            </Kb.Box2>
            <CoinFlipResultDeck deck={hand.hand} hand={true} />
          </Kb.Box2>
        ))}
    </Kb.Box2>
  </Kb.Box2>
)

type NumberType = {|
  number: ?string,
|}
const CoinFlipResultNumber = (props: NumberType) => (
  <Kb.Box2 direction="horizontal" fullWidth={true}>
    <Kb.Text selectable={true} type="Header">
      {props.number}
    </Kb.Text>
  </Kb.Box2>
)

type ShuffleType = {|
  shuffle: ?Array<string>,
|}
const CoinFlipResultShuffle = (props: ShuffleType) => (
  <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny">
    {props.shuffle &&
      props.shuffle.slice(0, 5).map((item, i) => <CoinFlipResultShuffleItem key={i} item={item} index={i} />)}
    {props.shuffle && props.shuffle.length > 5 && (
      <Kb.Box2 direction="horizontal" style={styles.listFullContainer}>
        <Kb.Text selectable={true} type="BodySmallSemibold" style={styles.listFull}>
          Full shuffle:{' '}
          <Kb.Text selectable={true} type="BodySmall" style={styles.listFull}>
            {props.shuffle && props.shuffle.join(', ')}
          </Kb.Text>
        </Kb.Text>
      </Kb.Box2>
    )}
  </Kb.Box2>
)

const CoinFlipResultShuffleItem = props => (
  <Kb.Box2 direction="horizontal" alignSelf="flex-start" centerChildren={true}>
    <Kb.Box2 direction="vertical" centerChildren={true} alignItems="center" style={styles.listOrderContainer}>
      <Kb.Text
        selectable={true}
        center={true}
        type={props.index === 0 ? 'BodyBig' : 'BodyTiny'}
        style={Styles.collapseStyles([styles.listOrder, props.index === 0 && styles.listOrderFirst])}
      >
        {props.index + 1}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Markdown allowFontScaling={true} styleOverride={props.index === 0 ? paragraphOverrides : undefined}>
      {props.item}
    </Kb.Markdown>
  </Kb.Box2>
)

const paragraphOverrides = {
  paragraph: {
    // These are Header's styles.
    fontSize: Styles.isMobile ? 20 : 18,
    fontWeight: '700',
  },
}

const styles = Styles.styleSheetCreate({
  card: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_10,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      flexShrink: 0,
      height: 44,
      marginRight: -4,
      width: 28,
    },
    isMobile: {
      height: 44,
      marginRight: -2,
      width: 28,
    },
  }),
  cardStacked: {
    marginBottom: 8,
  },
  cards: {
    flexWrap: 'wrap',
  },
  // compensate for the bottom margin on cards
  cardsStacked: Styles.platformStyles({
    isElectron: {
      marginBottom: -8,
    },
    isMobile: {
      marginBottom: -4,
    },
  }),
  coin: {
    height: 48,
    width: 48,
  },
  handTarget: Styles.platformStyles({
    isElectron: {
      minWidth: 150,
    },
    isMobile: {
      alignSelf: 'flex-start',
      marginBottom: Styles.globalMargins.xtiny,
    },
  }),
  listFull: {
    color: Styles.globalColors.black,
  },
  listFullContainer: {
    marginTop: Styles.globalMargins.tiny,
  },
  listOrder: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black_10,
      borderRadius: 2,
      color: Styles.globalColors.black,
      height: 14,
      width: 14,
    },
    isMobile: {
      position: 'relative',
      top: -1,
    },
  }),
  listOrderContainer: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
    width: 20,
  },
  listOrderFirst: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.black,
      color: Styles.globalColors.white,
      height: 18,
      width: 18,
    },
    isMobile: {
      height: 20,
      top: -2,
    },
  }),
})

export default CoinFlipResult
