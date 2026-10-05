import * as Kb from '@/common-adapters'

const BigTeamsLabel = () => {
  const styles = useStyles()
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.container}>
      <Kb.Box2 direction="horizontal" alignItems="center" style={styles.bigTeamsLabelBox}>
        <Kb.Text type="BodySmallSemibold">Big teams</Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  bigTeamsLabelBox: {
    minHeight: 24,
  },
  container: {
    height: isMobile ? 32 : 24,
    marginLeft: Kb.Styles.globalMargins.tiny,
  },
}))

export {BigTeamsLabel}
