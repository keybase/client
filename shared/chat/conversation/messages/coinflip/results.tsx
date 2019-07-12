import * as React from 'react'
import {partition} from 'lodash-es'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'

type Props = {
  result: RPCChatTypes.UICoinFlipResult
}

const CoinFlipResult = (props: Props) => {
  switch (props.result.typ) {
    case RPCChatTypes.UICoinFlipResultTyp.shuffle:
      return <CoinFlipResultShuffle shuffle={props.result.shuffle} />
    case RPCChatTypes.UICoinFlipResultTyp.deck:
      return <CoinFlipResultDeck deck={props.result.deck || undefined} />
    case RPCChatTypes.UICoinFlipResultTyp.hands:
      return <CoinFlipResultHands hands={props.result.hands} />
    case RPCChatTypes.UICoinFlipResultTyp.coin:
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
    color: Styles.globalColors.redDark,
    icon: 'iconfont-diamond',
  },
  hearts: {
    color: Styles.globalColors.redDark,
    icon: 'iconfont-heart',
  },
  spades: {
    color: Styles.globalColors.black,
    icon: 'iconfont-spade',
  },
}

type CardType = {
  card: number
  hand?: boolean
}

const Card = (props: CardType) => (
  <Kb.Box2 direction="vertical" centerChildren={true} style={styles.card}>
    <Kb.Box2 direction="horizontal">
      <Kb.Text
        selectable={true}
        type={Styles.isMobile ? 'BodySmall' : 'Body'}
        style={{color: suits[cards[props.card].suit].color}}
      >
        {cards[props.card].value}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal">
      <Kb.Icon
        fontSize={Styles.isMobile ? 10 : 12}
        type={suits[cards[props.card].suit].icon}
        color={suits[cards[props.card].suit].color}
        style={styles.cardSuit}
      />
    </Kb.Box2>
  </Kb.Box2>
)

type DeckType = {
  deck?: Array<number>
  hand?: boolean
}

const CoinFlipResultDeck = (props: DeckType) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([styles.cards, !props.hand && styles.noMarginTop])}
  >
    {props.deck && props.deck.map(card => <Card key={card} card={card} hand={props.hand} />)}
  </Kb.Box2>
)

type CoinType = {
  coin: boolean | null
}

const CoinFlipResultCoin = (props: CoinType) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.commonContainer}>
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

type HandType = {
  hands: Array<RPCChatTypes.UICoinFlipHand> | null
}

const CoinFlipResultHands = (props: HandType) => {
  if (!props.hands) return null
  const [handsWithCards, handsWithoutCards] = partition(props.hands, hand => hand.hand)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Box2 direction="vertical" fullHeight={true} style={styles.handTarget}>
          {handsWithCards.map(hand => (
            <Kb.Box2 key={hand.target} alignSelf="flex-start" alignItems="stretch" direction="vertical">
              <Kb.Text selectable={true} type="BodyBig">
                {hand.target}
              </Kb.Text>
            </Kb.Box2>
          ))}
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.handContainer}>
          {handsWithCards.map(hand => (
            <Kb.Box2
              key={hand.target}
              direction="vertical"
              alignSelf="flex-start"
              style={styles.commonContainer}
            >
              <CoinFlipResultDeck deck={hand.hand || undefined} hand={true} />
            </Kb.Box2>
          ))}
        </Kb.Box2>
      </Kb.Box2>
      {handsWithoutCards.length > 0 && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.commonContainer}>
          <Kb.Text type="BodySmallSemibold">
            Not enough cards for:{' '}
            <Kb.Text type="BodySmall">{handsWithoutCards.map(hand => hand.target).join(', ')}</Kb.Text>
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

type NumberType = {
  number: string | null
}

const CoinFlipResultNumber = (props: NumberType) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.commonContainer}>
    <Kb.Text selectable={true} type="Header" style={styles.break}>
      {props.number}
    </Kb.Text>
  </Kb.Box2>
)

type ShuffleType = {
  shuffle: Array<string> | null
}

const CoinFlipResultShuffle = (props: ShuffleType) => (
  <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny" style={styles.listContainer}>
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
    lineHeight: Styles.isMobile ? 24 : undefined,
  } as const,
}

const styles = Styles.styleSheetCreate({
  break: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
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
      marginTop: Styles.globalMargins.tiny,
      width: 28,
    },
    isMobile: {
      height: 36,
      marginRight: -2,
      width: 20,
    },
  }),
  cardSuit: Styles.platformStyles({
    isMobile: {
      position: 'relative',
      top: -1,
    },
  }),
  // compensate for the bottom margin on cards
  cards: Styles.platformStyles({
    common: {
      flexWrap: 'wrap',
    },
    isElectron: {
      marginTop: -Styles.globalMargins.tiny,
    },
    isMobile: {
      marginTop: -Styles.globalMargins.xtiny,
    },
  }),
  coin: {
    height: 48,
    width: 48,
  },
  commonContainer: {
    marginTop: Styles.globalMargins.tiny,
  },
  handContainer: {
    flexShrink: 1,
    paddingRight: Styles.globalMargins.tiny,
  },
  handTarget: {
    height: 'auto',
    justifyContent: 'space-around',
    paddingRight: Styles.globalMargins.tiny,
  },
  listContainer: {
    marginTop: Styles.globalMargins.xsmall,
  },
  listFull: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black,
    },
    isElectron: {
      wordBreak: 'break-word',
    },
  }),
  listFullContainer: {
    marginTop: Styles.globalMargins.tiny,
  },
  listOrder: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.greyDark,
      borderRadius: 2,
      color: Styles.globalColors.black,
      height: 14,
      width: 14,
    },
    isMobile: {
      height: 16,
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
  noMarginTop: {
    marginTop: 0,
  },
})

export default CoinFlipResult
