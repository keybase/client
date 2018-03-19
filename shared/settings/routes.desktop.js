// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import * as Constants from '../constants/settings'
import Settings from './'
import LandingContainer from './landing/container'
import UpdatePayment from './payment/container'
import AdvancedContainer from './advanced/container'
import FilesContainer from './files/container'
import DBNukeConfirm from './db-nuke-confirm/container'
import InvitationsContainer from './invites/container'
import NotificationsContainer from './notifications/container'
import DeleteContainer from './delete/container'
import DeleteConfirm from './delete-confirm/container'
import RemoveDevice from '../devices/device-revoke/container'
import InviteGenerated from './invite-generated'
import DevMenu from '../dev/dev-menu'
import DumbSheet from '../dev/dumb-sheet'
import Passphrase from './passphrase/container'
import UserEmail from './email/container'
import PlanDetails from './plan-details/container'

const routeTree = makeRouteDefNode({
  defaultSelected: Constants.landingTab,
  containerComponent: Settings,
  children: {
    [Constants.landingTab]: {
      component: LandingContainer,
      children: {
        changePassphrase: {
          component: Passphrase,
        },
        changeEmail: {
          component: UserEmail,
        },
        changePlan: {
          component: PlanDetails,
        },
      },
    },
    [Constants.updatePaymentTab]: {
      component: UpdatePayment,
    },
    [Constants.invitationsTab]: {
      component: InvitationsContainer,
      children: {
        inviteSent: {
          component: InviteGenerated,
        },
      },
    },
    [Constants.notificationsTab]: {
      component: NotificationsContainer,
    },
    [Constants.deleteMeTab]: {
      component: DeleteContainer,
      children: {
        deleteConfirm: {
          component: DeleteConfirm,
          tags: makeLeafTags({modal: true}),
        },
        removeDevice: {
          component: RemoveDevice,
          tags: makeLeafTags({modal: true}),
        },
      },
    },
    [Constants.devMenuTab]: {
      component: DevMenu,
      children: {
        dumbSheet: {
          component: DumbSheet,
          tags: makeLeafTags({modal: true}),
        },
      },
    },
    [Constants.advancedTab]: {
      component: AdvancedContainer,
      children: {
        dbNukeConfirm: {
          component: DBNukeConfirm,
          tags: makeLeafTags({modal: true}),
        },
      },
    },
    [Constants.fsTab]: {
      component: FilesContainer,
      children: {},
    },
  },
})

export default routeTree
