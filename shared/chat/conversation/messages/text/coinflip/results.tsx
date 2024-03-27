import partition from 'lodash/partition'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import capitalize from 'lodash/capitalize'

type Props = {
  result: T.RPCChat.UICoinFlipResult
}

// prettier-ignore
type CardIndex =
|0|1|2|3|4|5|6|7|8|9
|10|11|12|13|14|15|16|17|18|19
|20|21|22|23|24|25|26|27|28|29
|30|31|32|33|34|35|36|37|38|39
|40|41|42|43|44|45|46|47|48|49
|50|51

type CardType = {
  card: CardIndex
  hand?: boolean
}

function isCardIndex(value: number): value is CardIndex {
  return value >= 0 && value <= 51
}

function isArrayOfCardIndex(arr: ReadonlyArray<number>): arr is Array<CardIndex> {
  return arr.every(isCardIndex)
}

const CoinFlipResult = (props: Props) => {
  switch (props.result.typ) {
    case T.RPCChat.UICoinFlipResultTyp.shuffle:
      return <CoinFlipResultShuffle shuffle={props.result.shuffle} />
    case T.RPCChat.UICoinFlipResultTyp.deck: {
      const d = isArrayOfCardIndex(props.result.deck) ? props.result.deck : undefined
      return <CoinFlipResultDeck deck={d} />
    }
    case T.RPCChat.UICoinFlipResultTyp.hands:
      return <CoinFlipResultHands hands={props.result.hands} />
    case T.RPCChat.UICoinFlipResultTyp.coin:
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
] as const

const suits = {
  clubs: {
    color: Kb.Styles.globalColors.blackOrBlack,
    icon: 'iconfont-club',
  },
  diamonds: {
    color: Kb.Styles.globalColors.redDark,
    icon: 'iconfont-diamond',
  },
  hearts: {
    color: Kb.Styles.globalColors.redDark,
    icon: 'iconfont-heart',
  },
  spades: {
    color: Kb.Styles.globalColors.blackOrBlack,
    icon: 'iconfont-spade',
  },
} as const

const cardToTitle = (c: (typeof cards)[number]) => {
  let v: string
  switch (c.value) {
    case 'A':
      v = 'Ace'
      break
    case 'K':
      v = 'King'
      break
    case 'Q':
      v = 'Queen'
      break
    case 'J':
      v = 'Jack'
      break
    default:
      v = c.value
  }
  return `${v} of ${capitalize(c.suit)}`
}

const Card = (props: CardType) => (
  <Kb.Box2
    direction="vertical"
    centerChildren={true}
    style={styles.card}
    title={cardToTitle(cards[props.card])}
  >
    <Kb.Box2 direction="horizontal">
      <Kb.Text
        selectable={true}
        type={Kb.Styles.isMobile ? 'BodySmall' : 'Body'}
        style={{color: suits[cards[props.card].suit].color}}
      >
        {cards[props.card].value}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal">
      <Kb.Icon
        fontSize={Kb.Styles.isMobile ? 10 : 12}
        type={suits[cards[props.card]?.suit].icon}
        color={suits[cards[props.card].suit].color}
        style={styles.cardSuit}
      />
    </Kb.Box2>
  </Kb.Box2>
)

type DeckType = {
  deck?: Array<CardType['card']>
  hand?: boolean
}

const CoinFlipResultDeck = (props: DeckType) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    style={Kb.Styles.collapseStyles([styles.cards, !props.hand && styles.noMarginTop])}
  >
    {props.deck?.map(card => <Card key={card} card={card} hand={props.hand} />)}
  </Kb.Box2>
)

type CoinType = {
  coin?: boolean
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
  hands?: ReadonlyArray<T.RPCChat.UICoinFlipHand>
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
          {handsWithCards.map(hand => {
            const d = hand.hand && isArrayOfCardIndex(hand.hand) ? hand.hand : undefined
            return (
              <Kb.Box2
                key={hand.target}
                direction="vertical"
                alignSelf="flex-start"
                style={styles.commonContainer}
              >
                <CoinFlipResultDeck deck={d} hand={true} />
              </Kb.Box2>
            )
          })}
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
  number?: string
}

const CoinFlipResultNumber = (props: NumberType) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.commonContainer}>
    <Kb.Text selectable={true} type="Header" style={styles.break}>
      {props.number}
    </Kb.Text>
  </Kb.Box2>
)

type ShuffleType = {
  shuffle?: ReadonlyArray<string>
}

const CoinFlipResultShuffle = (props: ShuffleType) => (
  <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny" style={styles.listContainer}>
    {props.shuffle?.slice(0, 5).map((item, i) => <CoinFlipResultShuffleItem key={i} item={item} index={i} />)}
    {props.shuffle && props.shuffle.length > 5 && (
      <Kb.Box2 direction="horizontal" style={styles.listFullContainer}>
        <Kb.Text selectable={true} type="BodySmallBold" style={styles.listFull}>
          Full shuffle:{' '}
          <Kb.Text selectable={true} type="BodySmall" style={styles.listFull}>
            {props.shuffle.join(', ')}
          </Kb.Text>
        </Kb.Text>
      </Kb.Box2>
    )}
  </Kb.Box2>
)

const CoinFlipResultShuffleItem = (props: {index: number; item: string}) => (
  <Kb.Box2 direction="horizontal" alignSelf="flex-start" centerChildren={true}>
    <Kb.Box2 direction="vertical" centerChildren={true} alignItems="center" style={styles.listOrderContainer}>
      <Kb.Text
        selectable={true}
        center={true}
        type={props.index === 0 ? 'BodyBig' : 'BodyTiny'}
        style={Kb.Styles.collapseStyles([styles.listOrder, props.index === 0 && styles.listOrderFirst])}
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
    fontSize: Kb.Styles.isMobile ? 20 : 18,
    fontWeight: '700',
    lineHeight: Kb.Styles.isMobile ? 24 : undefined,
  } as const,
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      break: Kb.Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-all',
        },
      }),
      card: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.whiteOrWhite,
          borderColor: Kb.Styles.globalColors.black_10OrBlack,
          borderRadius: Kb.Styles.borderRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          flexShrink: 0,
          height: 44,
          marginRight: -4,
          marginTop: Kb.Styles.globalMargins.tiny,
          width: 28,
        },
        isMobile: {
          height: 36,
          marginRight: -2,
          width: 20,
        },
      }),
      cardSuit: Kb.Styles.platformStyles({
        isMobile: {
          position: 'relative',
          top: -1,
        },
      }),
      // compensate for the bottom margin on cards
      cards: Kb.Styles.platformStyles({
        common: {
          flexWrap: 'wrap',
        },
        isElectron: {
          marginTop: -Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          marginTop: -Kb.Styles.globalMargins.xtiny,
        },
      }),
      coin: {
        height: 48,
        width: 48,
      },
      commonContainer: {
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      handContainer: {
        flexShrink: 1,
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
      handTarget: {
        height: 'auto',
        justifyContent: 'space-around',
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
      listContainer: {
        marginTop: Kb.Styles.globalMargins.xsmall,
      },
      listFull: Kb.Styles.platformStyles({
        isElectron: {
          wordBreak: 'break-word',
        } as const,
      }),
      listFullContainer: {
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      listOrder: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.greyDark,
          borderRadius: 2,
          color: Kb.Styles.globalColors.black,
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
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginRight: Kb.Styles.globalMargins.xtiny,
        width: 20,
      },
      listOrderFirst: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.black,
          color: Kb.Styles.globalColors.white,
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
    }) as const
)

export default CoinFlipResult
