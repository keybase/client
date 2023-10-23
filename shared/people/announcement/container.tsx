import * as C from '../../constants'
import Announcement from '.'
import * as T from '../../constants/types'
import openURL from '../../util/open-url'

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
        switchTab(C.isMobile ? C.settingsTab : C.fsTab)
        if (C.isMobile) {
          navigateAppend(C.settingsFsTab)
        }
        break
      case T.RPCGen.AppLinkType.wallet:
        switchTab(C.isMobile ? C.settingsTab : C.walletsTab)
        if (C.isMobile) {
          navigateAppend(C.settingsWalletsTab)
        }
        break
      case T.RPCGen.AppLinkType.git:
        switchTab(C.isMobile ? C.settingsTab : C.gitTab)
        if (C.isMobile) {
          navigateAppend({props: {}, selected: C.settingsGitTab})
        }
        break
      case T.RPCGen.AppLinkType.devices:
        switchTab(C.isMobile ? C.settingsTab : C.devicesTab)
        if (C.isMobile) {
          navigateAppend(C.settingsDevicesTab)
        }
        break
      case T.RPCGen.AppLinkType.settings:
        switchTab(C.settingsTab)
        break
      case T.RPCGen.AppLinkType.teams:
        switchTab(C.teamsTab)
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
