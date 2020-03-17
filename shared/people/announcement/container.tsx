import Announcement from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTree from '../../actions/route-tree-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import openURL from '../../util/open-url'
import {namedConnect, isMobile} from '../../util/container'

type OwnProps = {
  appLink: RPCTypes.AppLinkType | null
  badged: boolean
  confirmLabel: string | null
  dismissable: boolean
  iconUrl: string | null
  id: RPCTypes.HomeScreenAnnouncementID
  text: string
  url: string | null
}

const mapStateToProps = () => ({})

// Really the saga should handle all of this and we shouldn't have any of these ownProps passed in but this
// is how the other types work in this list. TODO change this to be more modern
const mapDispatchToProps = dispatch => ({
  _onConfirm: (id, appLink, url) => {
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
        dispatch(RouteTree.createSwitchTab({tab: isMobile ? Tabs.settingsTab : Tabs.fsTab}))
        if (isMobile) {
          dispatch(RouteTree.createNavigateAppend({path: [SettingsTabs.fsTab]}))
        }
        break
      case RPCTypes.AppLinkType.wallet:
        dispatch(RouteTree.createSwitchTab({tab: isMobile ? Tabs.settingsTab : Tabs.walletsTab}))
        if (isMobile) {
          dispatch(RouteTree.createNavigateAppend({path: [SettingsTabs.walletsTab]}))
        }
        break
      case RPCTypes.AppLinkType.git:
        dispatch(RouteTree.createSwitchTab({tab: isMobile ? Tabs.settingsTab : Tabs.gitTab}))
        if (isMobile) {
          dispatch(RouteTree.createNavigateAppend({path: [SettingsTabs.gitTab]}))
        }
        break
      case RPCTypes.AppLinkType.devices:
        dispatch(RouteTree.createSwitchTab({tab: isMobile ? Tabs.settingsTab : Tabs.devicesTab}))
        if (isMobile) {
          dispatch(RouteTree.createNavigateAppend({path: [SettingsTabs.devicesTab]}))
        }
        break
      case RPCTypes.AppLinkType.settings:
        dispatch(RouteTree.createSwitchTab({tab: Tabs.settingsTab}))
        break
      case RPCTypes.AppLinkType.teams:
        dispatch(RouteTree.createSwitchTab({tab: Tabs.teamsTab}))
        break
    }
    dispatch(PeopleGen.createDismissAnnouncement({id}))
    dispatch(PeopleGen.createGetPeopleData({markViewed: true, numFollowSuggestionsWanted: 10}))
  },
  _onDismiss: id => {
    dispatch(PeopleGen.createDismissAnnouncement({id}))
    dispatch(PeopleGen.createGetPeopleData({markViewed: true, numFollowSuggestionsWanted: 10}))
  },
})

const mergeProps = (_, dispatchProps, ownProps: OwnProps) => ({
  badged: ownProps.badged,
  confirmLabel: ownProps.confirmLabel,
  iconUrl: ownProps.iconUrl,
  onConfirm: () => dispatchProps._onConfirm(ownProps.id, ownProps.appLink, ownProps.url),
  onDismiss: ownProps.dismissable ? () => dispatchProps._onDismiss(ownProps.id) : null,
  text: ownProps.text,
  url: ownProps.url,
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'Announcement')(Announcement)
