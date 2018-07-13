// @flow
import * as I from 'immutable'
import {makeRouteDefNode} from '../../route-tree'
import Login from './container'
import UsernameOrEmail from '../../provision/username-or-email/container'
import SelectOtherDevice from '../../provision/select-other-device/container'
import Passphrase from '../../provision/passphrase/container'
import PaperKey from '../../provision/paper-key/container'
import CodePage from '../../provision/code-page/container'
import SetPublicName from '../../provision/set-public-name/container'
import RegisterError from '../../provision/error/container'
import GPGSign from '../../provision/gpg-sign/container'
import Feedback from '../../settings/feedback-container'

const recursiveLazyRoutes = I.Seq({
  codePage: {component: CodePage},
  error: {component: RegisterError},
  feedback: {component: Feedback},
  gpgSign: {component: GPGSign},
  login: {component: Login},
  paperkey: {component: PaperKey},
  passphrase: {component: Passphrase},
  selectOtherDevice: {component: SelectOtherDevice},
  setPublicName: {component: SetPublicName},
  usernameOrEmail: {component: UsernameOrEmail},
})
  .map(routeData =>
    makeRouteDefNode({
      ...routeData,
      children: name => recursiveLazyRoutes.get(name),
    })
  )
  .toMap()

const routeTree = recursiveLazyRoutes.get('login')

export default routeTree
