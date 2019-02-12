// @flow
import {makeRouteDefNode, makeLeafTags} from '../route-tree'
import * as Constants from '../constants/settings'

const routeTree = () => {
  const Settings = require('./').default
  const LandingContainer = require('./landing/container').default
  // const UpdatePayment = require('./payment/container').default
  const AdvancedContainer = require('./advanced/container').default
  const FilesContainer = require('./files/container').default
  const DBNukeConfirm = require('./db-nuke-confirm/container').default
  const InvitationsContainer = require('./invites/container').default
  const NotificationsContainer = require('./notifications/container').default
  const ChatContainer = require('./chat/container').default
  const DeleteContainer = require('./delete/container').default
  const DeleteConfirm = require('./delete-confirm/container').default
  const RemoveDevice = require('../devices/device-revoke/container').default
  const InviteGenerated = require('./invite-generated/container').default
  const Passphrase = require('./passphrase/container').default
  const UserEmail = require('./email/container').default
  const SecurityPrefs = require('../fs/common/security-prefs-container.desktop').default
  return makeRouteDefNode({
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
      // [Constants.updatePaymentTab]: {
      // component: UpdatePayment,
      // },
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
}

export default routeTree
