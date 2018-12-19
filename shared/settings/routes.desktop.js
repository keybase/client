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
import ChatContainer from './chat/container'
import DeleteContainer from './delete/container'
import DeleteConfirm from './delete-confirm/container'
import RemoveDevice from '../devices/device-revoke/container'
import InviteGenerated from './invite-generated/container'
import Passphrase from './passphrase/container'
import UserEmail from './email/container'
// import PlanDetails from './plan-details/container'
import SecurityPrefs from '../fs/common/security-prefs-container.desktop'

const routeTree = makeRouteDefNode({
  children: {
    [Constants.landingTab]: {
      children: {
        changeEmail: {
          component: UserEmail,
        },
        changePassphrase: {
          component: Passphrase,
        },
        // changePlan: {
        // component: PlanDetails,
        // },
      },
      component: LandingContainer,
    },
    [Constants.updatePaymentTab]: {
      component: UpdatePayment,
    },
    [Constants.invitationsTab]: {
      children: {
        inviteSent: {
          component: InviteGenerated,
        },
      },
      component: InvitationsContainer,
    },
    [Constants.notificationsTab]: {
      component: NotificationsContainer,
    },
    [Constants.deleteMeTab]: {
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
      component: DeleteContainer,
    },
    [Constants.advancedTab]: {
      children: {
        dbNukeConfirm: {
          component: DBNukeConfirm,
          tags: makeLeafTags({modal: true}),
        },
      },
      component: AdvancedContainer,
    },
    [Constants.fsTab]: {
      children: {
        securityPrefs: {
          component: SecurityPrefs,
        },
      },
      component: FilesContainer,
    },
    [Constants.chatTab]: {
      component: ChatContainer,
    },
  },
  containerComponent: Settings,
  defaultSelected: Constants.landingTab,
})

export default routeTree
