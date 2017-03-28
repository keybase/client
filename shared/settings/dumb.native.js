// @flow
import About from './about'
import SettingsNav from './nav'
import Feedback from './feedback'
import * as settingsConstants from '../constants/settings'

import type {DumbComponentMap} from '../constants/types/more'

const aboutMap: DumbComponentMap<About> = {
  component: About,
  mocks: {
    'Normal': {version: '1.0.18-20161107120015+aee424b.'},
  },
}

const settingsNavMap: DumbComponentMap<SettingsNav> = {
  component: SettingsNav,
  mocks: {
    'Normal': {
      selectedTab: settingsConstants.landingTab,
      onTabChange: (tab) => console.log('clicked', tab),
      onLogout: () => {},
      badgeNumbers: {},
    },
  },
}

const feedbackMap: DumbComponentMap<Feedback> = {
  component: Feedback,
  mocks: {
    'Normal': {
      onSendFeedbackContained: () => console.log('Sent Feedback'),
      showSuccessBanner: false,
      sendLogs: true,
      feedback: null,
      onChangeFeedback: () => {},
      onChangeSendLogs: () => {},
    },
    'Success - Sent logs': {
      onSendFeedbackContained: () => console.log('Sent Feedback'),
      showSuccessBanner: true,
      sendLogs: true,
      feedback: null,
      onChangeFeedback: () => {},
      onChangeSendLogs: () => {},
    },
  },
}

export default {
  About: aboutMap,
  SettingsNav: settingsNavMap,
  Feedback: feedbackMap,
}
