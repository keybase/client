/// <reference types="jest" />
jest.mock('./router', () => ({
  navUpToScreen: jest.fn(),
  navigateAppend: jest.fn(),
  navigateToThread: jest.fn(),
  navToProfile: jest.fn(),
  previewConversation: jest.fn(),
  switchTab: jest.fn(),
}))
jest.mock('@/teams/team-page-actions', () => ({showTeamByName: jest.fn()}))
import * as Router from './router'
import * as Tabs from './tabs'
import {handleAppLink} from './deeplinks'

test('a devices link opens the devices list in settings', () => {
  handleAppLink('keybase://devices')

  expect(Router.switchTab).toHaveBeenCalledWith(Tabs.settingsTab)
  expect(Router.navUpToScreen).toHaveBeenCalledWith('devicesRoot')
  expect(Router.navigateAppend).not.toHaveBeenCalled()
})
