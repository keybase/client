import Announcement from '.'
import * as PeopleGen from '../../actions/people-gen'
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
        dispatch(RouteTree.createNavigateAppend({path: [Tabs.chatTab]}))
        break
      case RPCTypes.AppLinkType.files:
        dispatch(
          RouteTree.createNavigateAppend({
            path: isMobile ? [Tabs.settingsTab, SettingsTabs.fsTab] : [Tabs.fsTab],
          })
        )
        break
      case RPCTypes.AppLinkType.wallet:
        dispatch(
          RouteTree.createNavigateAppend({
            path: isMobile ? [Tabs.settingsTab, SettingsTabs.walletsTab] : [Tabs.walletsTab],
          })
        )
        break
      case RPCTypes.AppLinkType.git:
        dispatch(
          RouteTree.createNavigateAppend({
            path: isMobile ? [Tabs.settingsTab, SettingsTabs.gitTab] : [Tabs.gitTab],
          })
        )
        break
      case RPCTypes.AppLinkType.devices:
        dispatch(
          RouteTree.createNavigateAppend({
            path: isMobile ? [Tabs.settingsTab, SettingsTabs.devicesTab] : [Tabs.devicesTab],
          })
        )
        break
      case RPCTypes.AppLinkType.settings:
        dispatch(RouteTree.createNavigateAppend({path: [Tabs.settingsTab]}))
        break
      case RPCTypes.AppLinkType.teams:
        dispatch(RouteTree.createNavigateAppend({path: [Tabs.teamsTab]}))
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
