import * as C from '@/constants'
import Announcement from '.'
import * as T from '@/constants/types'
import openURL from '@/util/open-url'

type OwnProps = {
  appLink?: T.RPCGen.AppLinkType
  badged: boolean
  confirmLabel?: string
  dismissable: boolean
  iconUrl?: string
  id: T.RPCGen.HomeScreenAnnouncementID
  text: string
  url?: string
}

const Container = (ownProps: OwnProps) => {
  const {appLink, badged, confirmLabel, iconUrl, id, text, url, dismissable} = ownProps
  const loadPeople = C.usePeopleState(s => s.dispatch.loadPeople)
  const dismissAnnouncement = C.usePeopleState(s => s.dispatch.dismissAnnouncement)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const navigateToInbox = C.useChatState(s => s.dispatch.navigateToInbox)
  const onConfirm = () => {
    if (url) {
      openURL(url)
    }

    switch (appLink) {
      case T.RPCGen.AppLinkType.people:
        break
      case T.RPCGen.AppLinkType.chat:
        navigateToInbox()
        break
      case T.RPCGen.AppLinkType.files:
        switchTab(C.isMobile ? C.Tabs.settingsTab : C.Tabs.fsTab)
        if (C.isMobile) {
          navigateAppend(C.Settings.settingsFsTab)
        }
        break
      case T.RPCGen.AppLinkType.wallet:
        switchTab(C.Tabs.settingsTab)
        if (C.isMobile) {
          navigateAppend(C.Settings.settingsWalletsTab)
        }
        break
      case T.RPCGen.AppLinkType.git:
        switchTab(C.isMobile ? C.Tabs.settingsTab : C.Tabs.gitTab)
        if (C.isMobile) {
          navigateAppend(C.Settings.settingsGitTab)
        }
        break
      case T.RPCGen.AppLinkType.devices:
        switchTab(C.isMobile ? C.Tabs.settingsTab : C.Tabs.devicesTab)
        if (C.isMobile) {
          navigateAppend(C.Settings.settingsDevicesTab)
        }
        break
      case T.RPCGen.AppLinkType.settings:
        switchTab(C.Tabs.settingsTab)
        break
      case T.RPCGen.AppLinkType.teams:
        switchTab(C.Tabs.teamsTab)
        break
      default:
    }
    dismissAnnouncement(id)
    loadPeople(true, 10)
  }
  const _onDismiss = () => {
    dismissAnnouncement(id)
    loadPeople(true, 10)
  }
  const props = {
    badged,
    confirmLabel,
    iconUrl,
    onConfirm,
    onDismiss: dismissable ? _onDismiss : undefined,
    text,
    url,
  }
  return <Announcement {...props} />
}

export default Container
