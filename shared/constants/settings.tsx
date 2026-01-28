export const traceInProgressKey = 'settings:traceInProgress'
export const processorProfileInProgressKey = 'settings:processorProfileInProgress'

export const settingsAboutTab = 'settingsTabs.aboutTab'
export const settingsAdvancedTab = 'settingsTabs.advancedTab'
export const settingsArchiveTab = 'settingsTabs.archiveTab'
export const settingsChatTab = 'settingsTabs.chatTab'
export const settingsCryptoTab = 'settingsTabs.cryptoTab'
export const settingsDevicesTab = 'settingsTabs.devicesTab'
export const settingsDisplayTab = 'settingsTabs.displayTab'
export const settingsFeedbackTab = 'settingsTabs.feedbackTab'
export const settingsFoldersTab = 'settingsTabs.foldersTab'
export const settingsFsTab = 'settingsTabs.fsTab'
export const settingsGitTab = 'settingsTabs.gitTab'
export const settingsInvitationsTab = 'settingsTabs.invitationsTab'
export const settingsAccountTab = 'settingsTabs.accountTab'
export const settingsNotificationsTab = 'settingsTabs.notificationsTab'
export const settingsPasswordTab = 'settingsTabs.password'
export const settingsScreenprotectorTab = 'settingsTabs.screenprotector'
export const settingsLogOutTab = 'settingsTabs.logOutTab'
export const settingsUpdatePaymentTab = 'settingsTabs.updatePaymentTab'
export const settingsWalletsTab = 'settingsTabs.walletsTab'
export const settingsContactsTab = 'settingsTabs.contactsTab'
export const settingsWhatsNewTab = 'settingsTabs.whatsNewTab'

export type SettingsTab =
  | typeof settingsAccountTab
  | typeof settingsUpdatePaymentTab
  | typeof settingsInvitationsTab
  | typeof settingsNotificationsTab
  | typeof settingsAdvancedTab
  | typeof settingsFeedbackTab
  | typeof settingsAboutTab
  | typeof settingsDevicesTab
  | typeof settingsDisplayTab
  | typeof settingsGitTab
  | typeof settingsFoldersTab
  | typeof settingsFsTab
  | typeof settingsLogOutTab
  | typeof settingsScreenprotectorTab
  | typeof settingsPasswordTab
  | typeof settingsWalletsTab
  | typeof settingsChatTab
  | typeof settingsCryptoTab
  | typeof settingsContactsTab
  | typeof settingsWhatsNewTab
