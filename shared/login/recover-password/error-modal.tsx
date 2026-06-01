import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useConfigState} from '@/stores/config'

const styles = Kb.Styles.styleSheetCreate(() => ({
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      ...Kb.Styles.topDivider(),
    },
    isElectron: {
      ...Kb.Styles.roundedBottom(),
    },
  }),
}))

type Props = {route: {params: {error: string}}}

const ConnectedErrorModal = ({route}: Props) => {
  const loggedIn = useConfigState(s => s.loggedIn)
  const {error} = route.params
  const onBack = () => {
    if (loggedIn) {
      C.Router2.navigateUp()
    } else {
      C.Router2.popStack()
    }
  }

  return (
    <>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} padding="small">
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
