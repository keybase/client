import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {Wrapper, ContinueButton} from './common'

const ConnectedSignupError = () => {
  const error = C.useSignupState(s => s.signupError)
  const goBackAndClearErrors = C.useSignupState(s => s.dispatch.goBackAndClearErrors)
  const onBack = goBackAndClearErrors
  let header = 'Sign up failed'
  let body = error ? error.desc : 'Please try again.'
  if (!!error && C.isNetworkErr(error.code)) {
    header = 'Connection error'
    body = 'Unable to reach the server. Please check your internet connection and try again.'
  }
  const props = {
    body,
    header,
    onBack,
  }
  return <Error {...props} />
}

type Props = {
  header: string
  body: string
  onBack: () => void
}

const Error = (props: Props) => (
  <Wrapper onBack={() => {}}>
    <Kb.Text center={true} type="Header" style={{maxWidth: 460, width: '80%'}}>
      {props.header}
    </Kb.Text>
    <Kb.Text type="Body" center={true}>
      {props.body}
    </Kb.Text>
    <ContinueButton label="Back" onClick={props.onBack} />
  </Wrapper>
)

export default ConnectedSignupError
