import * as Container from '../../util/container'
import * as Constants from '../../constants/signup'
import * as Kb from '../../common-adapters'
import {Wrapper, ContinueButton} from './common'

const ConnectedSignupError = () => {
  const error = Container.useSelector(state => state.signup.signupError)
  const goBackAndClearErrors = Constants.useState(s => s.dispatch.goBackAndClearErrors)
  const onBack = goBackAndClearErrors
  let header = 'Ah Shoot! Something went wrong, try again?'
  let body = error ? error.desc : ''
  if (!!error && Container.isNetworkErr(error.code)) {
    header = 'Hit an unexpected error; try again?'
    body = 'This might be due to a bad connection.'
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
