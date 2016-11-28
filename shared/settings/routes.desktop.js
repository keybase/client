// @flow
import {RouteDefNode} from '../route-tree'
import {
  landingTab,
  updatePaymentTab,
  invitationsTab,
  notificationsTab,
  deleteMeTab,
  devMenuTab,
} from '../constants/settings'
import Settings from './'
import LandingContainer from './landing/container'
import UpdatePayment from './payment/container'
import InvitationsContainer from './invites/container'
import NotificationsContainer from './notifications/container'
import DeleteContainer from './delete/container'
import DeleteConfirm from './delete-confirm/container'
import RemoveDevice from '../devices/device-revoke'
import InviteGenerated from './invite-generated'
import DevMenu from '../dev/dev-menu'
import DumbSheet from '../dev/dumb-sheet'
import Passphrase from './passphrase/container'
import UserEmail from './email/container'
import PlanDetails from './plan-details/container'

const routeTree = new RouteDefNode({
  defaultSelected: landingTab,
  containerComponent: Settings,
  children: {
    [landingTab]: {
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
    [updatePaymentTab]: {
      component: UpdatePayment,
    },
    [invitationsTab]: {
      component: InvitationsContainer,
      children: {
        inviteSent: {
          component: InviteGenerated,
        },
      },
    },
    [notificationsTab]: {
      component: NotificationsContainer,
    },
    [deleteMeTab]: {
      component: DeleteContainer,
      children: {
        deleteConfirm: {
          component: DeleteConfirm,
          tags: {modal: true},
        },
        removeDevice: {
          component: RemoveDevice,
          tags: {modal: true},
        },
      },
    },
    [devMenuTab]: {
      component: DevMenu,
      children: {
        dumbSheet: {
          component: DumbSheet,
          tags: {modal: true},
        },
      },
    },
  },
})

export default routeTree
