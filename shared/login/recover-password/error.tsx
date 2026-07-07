import * as C from '@/constants'
import {SimpleErrorScreen} from '../simple-error'
import {useConfigState} from '@/stores/config'

type Props = {route: {params: {error: string}}}

const RecoverPasswordError = ({route}: Props) => {
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
    <SimpleErrorScreen
      heading="Password recovery failed"
      message={error}
      onBack={onBack}
      title="Recover password"
    />
  )
}

export default RecoverPasswordError
