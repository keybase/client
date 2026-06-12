import * as C from '@/constants'
import {SimpleErrorScreen} from '../simple-error'
import type {StaticScreenProps} from '@react-navigation/core'

type Props = StaticScreenProps<{errorCode?: number; errorMessage?: string}>

const ConnectedSignupError = (p: Props) => {
  const errorCode = p.route.params.errorCode
  const errorMessage = p.route.params.errorMessage ?? ''
  let heading = 'Ah Shoot! Something went wrong, try again?'
  let message = errorMessage
  if (errorCode !== undefined && C.isNetworkErr(errorCode)) {
    heading = 'Hit an unexpected error; try again?'
    message = 'This might be due to a bad connection.'
  }
  return <SimpleErrorScreen heading={heading} message={message} onBack={C.Router2.navigateUp} />
}

export default ConnectedSignupError
