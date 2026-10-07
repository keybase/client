import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {useConfigState} from '@/stores/config'

type Props = {route: {params: {error: string}}}

const ErrorModal = ({route}: Props) => {
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
    <Kb.ModalScreen centered={true} footer={<Kb.Button label="Back" onClick={onBack} fullWidth={true} />}>
      <Kb.Text type="Body" center={true}>
        {error}
      </Kb.Text>
    </Kb.ModalScreen>
  )
}
export default ErrorModal
