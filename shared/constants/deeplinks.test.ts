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
import {settingsDevicesTab} from './settings'
import {handleAppLink} from './deeplinks'

const withIsMobile = (isMobile: boolean, f: () => void) => {
  const was = global.isMobile
  global.isMobile = isMobile
  try {
    f()
  } finally {
    global.isMobile = was
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

// On desktop handleAppLink IS the linking subscription's listener (router.tsx passes it as
// both listener and fallback), so this case is the whole implementation there.
test('a devices link opens the devices tab on desktop', () => {
  withIsMobile(false, () => {
    handleAppLink('keybase://devices')

    expect(Router.switchTab).toHaveBeenCalledWith(Tabs.devicesTab)
    expect(Router.navUpToScreen).toHaveBeenCalledWith('devicesRoot')
    expect(Router.navigateAppend).not.toHaveBeenCalled()
  })
})

test('a devices link opens the devices screen under settings on mobile', () => {
  withIsMobile(true, () => {
    handleAppLink('keybase://devices')

    expect(Router.switchTab).toHaveBeenCalledWith(Tabs.settingsTab)
    expect(Router.navUpToScreen).toHaveBeenCalledWith(settingsDevicesTab)
    expect(Router.navigateAppend).not.toHaveBeenCalled()
  })
})

// The invite install link normalizes to this; the linking config handles it on mobile, but
// desktop routes every URL through here, so both have to agree on where it goes.
test('an add-phone link opens the add-phone modal over settings', () => {
  withIsMobile(false, () => {
    handleAppLink('keybase://settingsAddPhone')

    expect(Router.switchTab).toHaveBeenCalledWith(Tabs.settingsTab)
    expect(Router.navigateAppend).toHaveBeenCalledWith({name: 'settingsAddPhone', params: {}})
  })
})
