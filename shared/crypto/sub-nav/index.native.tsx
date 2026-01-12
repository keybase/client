import * as C from '@/constants'
import * as Crypto from '@/stores/crypto'
import * as Kb from '@/common-adapters'
import NavRow from './nav-row'

const CryptoSubNav = () => {
  const {navigate} = C.useNav()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="tiny" style={styles.container}>
      {Crypto.Tabs.map(t => (
        <NavRow
          key={t.tab}
          tab={t.tab}
          title={t.title}
          illustration={t.illustration}
          description={t.description}
          onClick={() => navigate(t.tab)}
        />
      ))}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
        paddingTop: Kb.Styles.globalMargins.xsmall,
      },
    }) as const
)

export default CryptoSubNav
