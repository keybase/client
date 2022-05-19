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
  'settingsTabs.feedbackTab': {
    heading: string
    feedback: string
  }
  'settingsTabs.feedbackTab': {
    heading: string
    feedback: string
  }
  inviteSent: {
    email: string
    link: string
  }
  privacyPolicy: {
    url: string
    title: string
  }
}
