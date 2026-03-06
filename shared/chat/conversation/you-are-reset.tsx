import * as Kb from '@/common-adapters'

const YouAreReset = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} flex={1}>
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      flex={1}
    >
      <Kb.Icon type={Kb.Styles.isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
    </Kb.Box2>
    <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.box}>
      <Kb.Text type="BodySemibold" negative={true} style={{textAlign: 'center' as const}}>
        Since you reset your account, participants have to accept to let you back in.
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: {
        backgroundColor: Kb.Styles.globalColors.red,
        padding: Kb.Styles.globalMargins.small,
      },
    }) as const
)

export default YouAreReset
