import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {Wrapper, ContinueButton} from './common'
import type {StaticScreenProps} from '@react-navigation/core'

type Props = StaticScreenProps<{errorCode?: number; errorMessage?: string}>

const ConnectedSignupError = (p: Props) => {
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const errorCode = p.route.params.errorCode
  const errorMessage = p.route.params.errorMessage ?? ''
  let header = 'Ah Shoot! Something went wrong, try again?'
  let body = errorMessage
  if (errorCode !== undefined && C.isNetworkErr(errorCode)) {
    header = 'Hit an unexpected error; try again?'
    body = 'This might be due to a bad connection.'
  }
  return (
    <Wrapper onBack={() => {}}>
      <Kb.Text center={true} type="Header" style={{maxWidth: 460, width: '80%'}}>
        {header}
      </Kb.Text>
      <Kb.Text type="Body" center={true}>
        {body}
      </Kb.Text>
      <ContinueButton label="Back" onClick={navigateUp} />
    </Wrapper>
  )
}

export default ConnectedSignupError
