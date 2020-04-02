import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

const EmojiHeader = () => {
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.containerNew}>
      <Kb.Text type="BodyTiny" style={styles.emoji}>
        Emoji
      </Kb.Text>
      <Kb.Text type="BodyTiny">Alias</Kb.Text>
      <Kb.Text type="BodyTiny" style={styles.date}>
        Date added
      </Kb.Text>
      <Kb.Text type="BodyTiny" style={styles.username}>
        Added by
      </Kb.Text>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  containerNew: {
    ...Styles.padding(6, Styles.globalMargins.small),
    justifyContent: 'flex-end',
  },
  date: {
    marginLeft: 'auto',
    width: 130 + Styles.globalMargins.small,
  },
  emoji: {
    width: 72 - Styles.globalMargins.small,
  },
  text: {padding: Styles.globalMargins.xtiny},
  username: {
    marginRight: 54, // width of icon button + gap + padding
    width: 210,
  },
}))

export default EmojiHeader
