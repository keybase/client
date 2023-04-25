import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as SignupGen from '../../actions/signup-gen'
import {Wrapper, ContinueButton} from './common'

const ConnectedSignupError = () => {
  const error = Container.useSelector(state => state.signup.signupError)
  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(SignupGen.createGoBackAndClearErrors())
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
export default ConnectedSignupError

export const options = {
  gesturesEnabled: false,
  headerLeft: null,
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
