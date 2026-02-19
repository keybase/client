import * as Kb from '@/common-adapters'

const EmojiHeader = () => {
  return (
    <>
      <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.containerNew}>
        <Kb.Text3 type="BodyTiny" style={styles.emoji}>
          Emoji
        </Kb.Text3>
        <Kb.Text3 type="BodyTiny">Alias</Kb.Text3>
        <Kb.Text3 type="BodyTiny" style={styles.date}>
          Date added
        </Kb.Text3>
        <Kb.Text3 type="BodyTiny" style={styles.username}>
          Added by
        </Kb.Text3>
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
  username: {
    marginRight: Kb.Styles.globalMargins.large + Kb.Styles.globalMargins.small, // width of icon button + gap + padding
    width: 210,
  },
}))

export default EmojiHeader
