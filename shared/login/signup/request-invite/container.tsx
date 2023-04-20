import * as SignupGen from '../../../actions/signup-gen'
import * as Container from '../../../util/container'
import RequestInvite from '.'

export default () => {
  const emailError = Container.useSelector(state => state.signup.emailError)
  const nameError = Container.useSelector(state => state.signup.nameError)
  const dispatch = Container.useDispatch()
  const onBack = () => {
    dispatch(SignupGen.createGoBackAndClearErrors())
  }
  const onSubmit = (email: string, name: string) => {
    dispatch(SignupGen.createRequestInvite({email, name}))
  }
  const props = {emailError, nameError, onBack, onSubmit}
  return <RequestInvite {...props} />
}
