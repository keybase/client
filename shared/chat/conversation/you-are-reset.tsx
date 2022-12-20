import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const YouAreReset = () => (
  <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, flex: 1}}>
    <Kb.Box
      style={{
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
      }}
    >
      <Kb.Icon type={Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
    </Kb.Box>
    <Kb.Box style={styles.box}>
      <Kb.Text type="BodySemibold" negative={true} style={{textAlign: 'center' as const}}>
        Since you reset your account, participants have to accept to let you back in.
      </Kb.Text>
    </Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Styles.globalColors.red,
        padding: Styles.globalMargins.small,
      },
    } as const)
)

export default YouAreReset
