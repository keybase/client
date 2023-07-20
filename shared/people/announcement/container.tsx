import Announcement from '.'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTree from '../../actions/route-tree-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as RouterConstants from '../../constants/router2'
import * as Constants from '../../constants/people'
import * as SettingsTabs from '../../constants/settings'
import openURL from '../../util/open-url'
import * as Container from '../../util/container'

type OwnProps = {
  appLink?: RPCTypes.AppLinkType
  badged: boolean
  confirmLabel?: string
  dismissable: boolean
  iconUrl?: string
  id: RPCTypes.HomeScreenAnnouncementID
  text: string
  url?: string
}

export default (ownProps: OwnProps) => {
  const {appLink, badged, confirmLabel, iconUrl, id, text, url, dismissable} = ownProps
  const dispatch = Container.useDispatch()

  const loadPeople = Constants.useState(s => s.dispatch.loadPeople)
  const dismissAnnouncement = Constants.useState(s => s.dispatch.dismissAnnouncement)

  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const onConfirm = () => {
    if (url) {
      openURL(url)
    }

    switch (appLink) {
      case RPCTypes.AppLinkType.people:
        break
      case RPCTypes.AppLinkType.chat:
        dispatch(Chat2Gen.createNavigateToInbox())
        break
      case RPCTypes.AppLinkType.files:
        switchTab(Container.isMobile ? Tabs.settingsTab : Tabs.fsTab)
        if (Container.isMobile) {
          dispatch(RouteTree.createNavigateAppend({path: [SettingsTabs.fsTab]}))
        }
        break
      case RPCTypes.AppLinkType.wallet:
        switchTab(Container.isMobile ? Tabs.settingsTab : Tabs.walletsTab)
        if (Container.isMobile) {
          dispatch(RouteTree.createNavigateAppend({path: [SettingsTabs.walletsTab]}))
        }
        break
      case RPCTypes.AppLinkType.git:
        switchTab(Container.isMobile ? Tabs.settingsTab : Tabs.gitTab)
        if (Container.isMobile) {
          dispatch(RouteTree.createNavigateAppend({path: [{props: {}, selected: SettingsTabs.gitTab}]}))
        }
        break
      case RPCTypes.AppLinkType.devices:
        switchTab(Container.isMobile ? Tabs.settingsTab : Tabs.devicesTab)
        if (Container.isMobile) {
          dispatch(RouteTree.createNavigateAppend({path: [SettingsTabs.devicesTab]}))
        }
        break
      case RPCTypes.AppLinkType.settings:
        switchTab(Tabs.settingsTab)
        break
      case RPCTypes.AppLinkType.teams:
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
