import * as Kb from '@/common-adapters'

const YouAreReset = () => (
  <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn, flex: 1}}>
    <Kb.Box
      style={{
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
      }}
    >
      <Kb.Icon type={Kb.Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
    </Kb.Box>
    <Kb.Box style={styles.box}>
      <Kb.Text type="BodySemibold" negative={true} style={{textAlign: 'center' as const}}>
        Since you reset your account, participants have to accept to let you back in.
      </Kb.Text>
    </Kb.Box>
  </Kb.Box>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.red,
        padding: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default YouAreReset
