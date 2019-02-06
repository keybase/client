// @flow
import Announcement from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as RouteTree from '../../actions/route-tree-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as SettingsTabs from '../../constants/settings'
import openURL from '../../util/open-url'
import {namedConnect, isMobile} from '../../util/container'

type OwnProps = {|
  appLink: ?RPCTypes.AppLinkType,
  badged: boolean,
  confirmLabel: ?string,
  dismissable: boolean,
  iconUrl: ?string,
  id: RPCTypes.HomeScreenAnnouncementID,
  text: string,
  url: ?string,
|}

const mapStateToProps = () => ({})

// Really the saga should handle all of this and we shouldn't have any of these ownProps passed in but this
// is how the other types work in this list. TODO change this to be more modern
const mapDispatchToProps = dispatch => ({
  _onConfirm: (id, appLink, url) => {
    if (url) {
      openURL(url)
    }

    switch (appLink) {
      case RPCTypes.homeAppLinkType.people:
        break
      case RPCTypes.homeAppLinkType.chat:
        dispatch(RouteTree.createSwitchTo({path: [Tabs.chatTab]}))
        break
      case RPCTypes.homeAppLinkType.files:
        dispatch(
          RouteTree.createSwitchTo({path: isMobile ? [Tabs.settingsTab, SettingsTabs.fsTab] : [Tabs.fsTab]})
        )
        break
      case RPCTypes.homeAppLinkType.wallet:
        dispatch(
          RouteTree.createSwitchTo({
            path: isMobile ? [Tabs.settingsTab, SettingsTabs.walletsTab] : [Tabs.walletsTab],
          })
        )
        break
      case RPCTypes.homeAppLinkType.git:
        dispatch(
          RouteTree.createSwitchTo({path: isMobile ? [Tabs.settingsTab, SettingsTabs.gitTab] : [Tabs.gitTab]})
        )
        break
      case RPCTypes.homeAppLinkType.devices:
        dispatch(
          RouteTree.createSwitchTo({
            path: isMobile ? [Tabs.settingsTab, SettingsTabs.devicesTab] : [Tabs.devicesTab],
          })
        )
        break
      case RPCTypes.homeAppLinkType.settings:
        dispatch(RouteTree.createSwitchTo({path: [Tabs.settingsTab]}))
        break
      case RPCTypes.homeAppLinkType.teams:
        dispatch(RouteTree.createSwitchTo({path: [Tabs.teamsTab]}))
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

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badged: ownProps.badged,
  confirmLabel: ownProps.confirmLabel,
  iconUrl: ownProps.iconUrl,
  onConfirm: () => dispatchProps._onConfirm(ownProps.id, ownProps.appLink, ownProps.url),
  onDismiss: ownProps.dismissable ? () => dispatchProps._onDismiss(ownProps.id) : null,
  text: ownProps.text,
  url: ownProps.url,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Announcement'
)(Announcement)
