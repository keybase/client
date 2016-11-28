// @flow
import * as I from 'immutable'
import {RouteDefNode} from '../../route-tree'
import Login from './'
import UsernameOrEmail from '../register/username-or-email'
import SelectOtherDevice from '../register/select-other-device'
import Passphrase from '../register/passphrase'
import PaperKey from '../register/paper-key'
import CodePage from '../register/code-page'
import SetPublicName from '../register/set-public-name'
import Success from '../signup/success'
import RegisterError from '../register/error'

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
  .map(routeData => () => new RouteDefNode({
    ...routeData,
    children: recursiveLazyRoutes,
  }))
  .toMap()

const routeTree = new RouteDefNode({
  defaultSelected: 'login',
  children: recursiveLazyRoutes,
})

export default routeTree
