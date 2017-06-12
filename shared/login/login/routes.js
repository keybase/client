// @flow
import * as I from 'immutable'
import {RouteDefNode} from '../../route-tree'
import Login from './container'
import UsernameOrEmail from '../register/username-or-email/container'
import SelectOtherDevice from '../register/select-other-device/container'
import Passphrase from '../register/passphrase/container'
import PaperKey from '../register/paper-key/container'
import CodePage from '../register/code-page/container'
import SetPublicName from '../register/set-public-name/container'
import Success from '../register/success/container'
import RegisterError from '../register/error/container'
import GPGSign from '../register/gpg-sign/container'

const recursiveLazyRoutes = I.Seq({
  login: {
    component: Login,
  },
  error: {
    component: RegisterError,
  },
  usernameOrEmail: {
    component: UsernameOrEmail,
  },
  selectOtherDevice: {
    component: SelectOtherDevice,
  },
  passphrase: {
    component: Passphrase,
  },
  gpgSign: {
    component: GPGSign,
  },
  paperkey: {
    component: PaperKey,
  },
  codePage: {
    component: CodePage,
  },
  setPublicName: {
    component: SetPublicName,
  },
  success: {
    component: Success,
  },
})
  .map(
    routeData =>
      new RouteDefNode({
        ...routeData,
        children: name => recursiveLazyRoutes.get(name),
      })
  )
  .toMap()

const routeTree = recursiveLazyRoutes.get('login')

export default routeTree
