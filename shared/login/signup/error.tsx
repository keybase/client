import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {Wrapper, ContinueButton} from './common'
import {useSignupState} from '@/stores/signup'

const ConnectedSignupError = () => {
  const error = useSignupState(s => s.signupError)
  const goBackAndClearErrors = useSignupState(s => s.dispatch.goBackAndClearErrors)
  const onBack = goBackAndClearErrors
  let header = 'Ah Shoot! Something went wrong, try again?'
  let body = error ? error.desc : ''
  if (!!error && C.isNetworkErr(error.code)) {
    header = 'Hit an unexpected error; try again?'
    body = 'This might be due to a bad connection.'
  }
  return (
    <Wrapper onBack={() => {}}>
      <Kb.Text3 center={true} type="Header" style={{maxWidth: 460, width: '80%'}}>
        {header}
      </Kb.Text3>
      <Kb.Text3 type="Body" center={true}>
        {body}
      </Kb.Text3>
      <ContinueButton label="Back" onClick={onBack} />
    </Wrapper>
  )
}

export default ConnectedSignupError
