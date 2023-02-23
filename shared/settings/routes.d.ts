declare const newRoutes: {}
declare const newModalRoutes: {}
export {newRoutes, newModalRoutes}

export type RootParamListSettings = {
  settingsDeleteAddress: {
    address: string
    searchable: boolean
    type: 'email' | 'phone'
    lastEmail?: boolean
  }
  inviteSent: {
    email: string
    link: string
  }
  webLinks: {
    url: string
    title: string
  }
  'settingsTabs.feedbackTab': {
    heading: string
    feedback: string
  }
  'settingsTabs.aboutTab': undefined
  'settingsTabs.advancedTab': undefined
  'settingsTabs.chatTab': undefined
  'settingsTabs:cryptoTab': undefined
  'settingsTabs.devicesTab': undefined
  'settingsTabs.displayTab': undefined
  'settingsTabs.foldersTab': undefined
  'settingsTabs.fsTab': undefined
  'settingsTabs.gitTab': undefined
  'settingsTabs.invitationsTab': undefined
  'settingsTabs.accountTab': undefined
  'settingsTabs.notificationsTab': undefined
  'settingsTabs.password': undefined
  'settingsTabs.screenprotector': undefined
  'settingsTabs.logOutTab': undefined
  'settingsTabs.updatePaymentTab': undefined
  'settingsTabs.walletsTab': undefined
  'settingsTabs.contactsTab': undefined
  'settingsTabs.whatsNewTab': undefined
  deleteConfirm: undefined
  disableCertPinningModal: undefined
  modalFeedback: undefined
  settingsAddEmail: undefined
  settingsAddPhone: undefined
  settingsVerifyPhone: undefined
  settingsRoot: undefined
  checkPassphraseBeforeDeleteAccount: undefined
  settingsContactsJoined: undefined
  settingsPushPrompt: undefined
  addEmail: undefined
  addPhone: undefined
  dbNukeConfirm: undefined
  removeDevice: undefined
}
