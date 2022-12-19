import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

const EmojiHeader = () => {
  return (
    <>
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
      <Kb.Divider style={styles.divider} />
    </>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  containerNew: {
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, 6),
  },
  date: {
    marginLeft: 'auto',
    width: 130 + Styles.globalMargins.small,
  },
  divider: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
    maxHeight: 2,
    minHeight: 2,
  },
  emoji: {
    marginRight: Styles.globalMargins.medium + Styles.globalMargins.xtiny,
    width: 72 - Styles.globalMargins.small,
  },
  text: {padding: Styles.globalMargins.xtiny},
  username: {
    marginRight: Styles.globalMargins.large + Styles.globalMargins.small, // width of icon button + gap + padding
    width: 210,
  },
}))

export default EmojiHeader
