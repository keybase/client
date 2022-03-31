import * as Constants from '../constants/settings'
import type FeedbackTab from './feedback/container'
import type Root from './root-desktop-tablet'
import type DeleteConfirm from './delete-confirm/index'
import type LogOutTab from './logout/container'
import type ChangePassword from './password/container'
import type DisableCertPinningModal from './disable-cert-pinning-modal/container'
import type {DeleteModal} from './account/confirm-delete'
import type {Email, Phone, VerifyPhone} from './account/add-modals'
import {sharedNewRoutes, sharedNewModalRoutes} from './routes.shared'

export const newRoutes = {
  settingsRoot: {
    getScreen: (): typeof Root => require('./root-desktop-tablet').default,
    skipShim: true,
  },
  ...sharedNewRoutes,
}
export const newModalRoutes = {
  ...sharedNewModalRoutes,
  [Constants.logOutTab]: {getScreen: (): typeof LogOutTab => require('./logout/container').default},
  [Constants.passwordTab]: {getScreen: (): typeof ChangePassword => require('./password/container').default},
  deleteConfirm: {getScreen: (): typeof DeleteConfirm => require('./delete-confirm/index').default},
  disableCertPinningModal: {
    getScreen: (): typeof DisableCertPinningModal =>
      require('./disable-cert-pinning-modal/container').default,
  },
  modalFeedback: {getScreen: (): typeof FeedbackTab => require('../signup/feedback/container').default},
  settingsAddEmail: {getScreen: (): typeof Email => require('./account/add-modals').Email},
  settingsAddPhone: {getScreen: (): typeof Phone => require('./account/add-modals').Phone},
  settingsDeleteAddress: {
    getScreen: (): typeof DeleteModal => require('./account/confirm-delete').DeleteModal,
  },
  settingsVerifyPhone: {getScreen: (): typeof VerifyPhone => require('./account/add-modals').VerifyPhone},
}
