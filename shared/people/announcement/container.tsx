import * as C from '../../constants'
import Announcement from '.'
import * as T from '../../constants/types'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import openURL from '../../util/open-url'
import * as Container from '../../util/container'

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

export default (ownProps: OwnProps) => {
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
        switchTab(Container.isMobile ? Tabs.settingsTab : Tabs.fsTab)
        if (Container.isMobile) {
          navigateAppend(SettingsTabs.fsTab)
        }
        break
      case T.RPCGen.AppLinkType.wallet:
        switchTab(Container.isMobile ? Tabs.settingsTab : Tabs.walletsTab)
        if (Container.isMobile) {
          navigateAppend(SettingsTabs.walletsTab)
        }
        break
      case T.RPCGen.AppLinkType.git:
        switchTab(Container.isMobile ? Tabs.settingsTab : Tabs.gitTab)
        if (Container.isMobile) {
          navigateAppend({props: {}, selected: SettingsTabs.gitTab})
        }
        break
      case T.RPCGen.AppLinkType.devices:
        switchTab(Container.isMobile ? Tabs.settingsTab : Tabs.devicesTab)
        if (Container.isMobile) {
          navigateAppend(SettingsTabs.devicesTab)
        }
        break
      case T.RPCGen.AppLinkType.settings:
        switchTab(Tabs.settingsTab)
        break
      case T.RPCGen.AppLinkType.teams:
        switchTab(Tabs.teamsTab)
        break
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
