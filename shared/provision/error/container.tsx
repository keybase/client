import RenderError from '.'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import openURL from '../../util/open-url'
import * as AutoresetGen from '../../actions/autoreset-gen'

const ConnectedRenderError = () => {
  const _username = Container.useSelector(state => state.provision.username)
  const error = Container.useSelector(state => state.provision.finalError)
  const dispatch = Container.useDispatch()
  const _onAccountReset = (username: string) => {
    dispatch(AutoresetGen.createStartAccountReset({skipPassword: false, username}))
  }
  const onBack = () => {
    dispatch(RouteTreeGen.createNavigateUp())
  }
  const onKBHome = () => {
    openURL('https://keybase.io/')
  }
  const onPasswordReset = () => {
    openURL('https://keybase.io/#password-reset')
  }
  const props = {
    error,
    onAccountReset: () => _onAccountReset(_username),
    onBack,
    onKBHome,
    onPasswordReset,
  }
  return <RenderError {...props} />
}

export default ConnectedRenderError
