import * as Kb from '@/common-adapters'

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

const styles = Kb.Styles.styleSheetCreate(() => ({
  containerNew: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.small, Kb.Styles.globalMargins.small, 6),
  },
  date: {
    marginLeft: 'auto',
    width: 130 + Kb.Styles.globalMargins.small,
  },
  divider: {
    marginLeft: Kb.Styles.globalMargins.small,
    marginRight: Kb.Styles.globalMargins.small,
    maxHeight: 2,
    minHeight: 2,
  },
  emoji: {
    marginRight: Kb.Styles.globalMargins.medium + Kb.Styles.globalMargins.xtiny,
    width: 72 - Kb.Styles.globalMargins.small,
  },
  text: {padding: Kb.Styles.globalMargins.xtiny},
  username: {
    marginRight: Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.small, // width of icon button + gap + padding
    width: 210,
  },
}))

export default EmojiHeader
