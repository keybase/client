// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

const suitToColor = (suit: string): Styles.Color => {
  console.log('spooner', suit, suit === '♦️')
  switch (suit) {
    case '♦️':
    case '♥️':
      return Styles.globalColors.red
    default:
      return Styles.globalColors.black
  }
}

const suitToIcon = (suit: string): Kb.IconType => {
  switch (suit) {
    case '♦️':
      return 'iconfont-star'
    case '♥️':
      return 'iconfont-reacji-heart'
    case '♠️':
      return 'iconfont-gear'
    default:
      return 'iconfont-bomb'
  }
}

type CardProps = {|
  suit: string,
  value: string,
|}

const Card = (props: CardProps) => (
  <Kb.Box2 direction="vertical" centerChildren={true} gap="xtiny" style={styles.card}>
    <Kb.Box2 direction="horizontal">
      <Kb.Text type="Header" style={{color: suitToColor(props.suit)}}>
        {props.value}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal">
      <Kb.Icon type={suitToIcon(props.suit)} color={suitToColor(props.suit)} />
    </Kb.Box2>
  </Kb.Box2>
)

const renderCardsFromString = (cards: string) =>
  cards.split(', ').map(card => {
    const sliceAt = card.search(/(♠️|♣️|♦️|♥️)/g)
    const props = {suit: card.slice(sliceAt, -1), value: card.slice(0, sliceAt)}
    return <Card key={card} {...props} />
  })

type CardsProps = {|
  cardsString: string,
|}

const Cards = (props: CardsProps) => {
  const multiPersonShuffle = props.cardsString.includes('\n')
  return (
    <Kb.Box2 direction={multiPersonShuffle ? 'vertical' : 'horizontal'} alignSelf="flex-start">
      {multiPersonShuffle
        ? props.cardsString.split('\n').map(rows => {
            const [username, ...cards] = rows.split(': ')
            return (
              <Kb.Box2 key={username} direction="horizontal" alignItems="center" fullWidth={true}>
                <Kb.Text type="BodyBig">{username}</Kb.Text>
                {renderCardsFromString(cards[0])}
              </Kb.Box2>
            )
          })
        : renderCardsFromString(props.cardsString)}
    </Kb.Box2>
  )
}

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
})

export default Cards
