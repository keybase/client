import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useConfigState} from '@/stores/config'

const styles = Kb.Styles.styleSheetCreate(() => ({
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
  padding: {
    padding: Kb.Styles.globalMargins.small,
  },
}))

type Props = {route: {params: {error: string}}}

const ConnectedErrorModal = ({route}: Props) => {
  const loggedIn = useConfigState(s => s.loggedIn)
  const {error} = route.params
  const popStack = C.useRouterState(s => s.dispatch.popStack)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => {
    loggedIn ? navigateUp() : popStack()
  }

  return (
    <>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.padding}>
        <Kb.Text type="Body" center={true}>
          {error}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
        <Kb.Button label="Back" onClick={onBack} fullWidth={true} />
      </Kb.Box2>
    </>
  )
}
export default ConnectedErrorModal
