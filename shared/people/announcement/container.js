// @flow
import Announcement from '.'
import * as PeopleGen from '../../actions/people-gen'
import * as RouteTree from '../../actions/route-tree-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as Types from '../../constants/types/people'
import openURL from '../../util/open-url'
import {namedConnect, isMobile} from '../../util/container'

type OwnProps = {|
  appLink: ?Types.AppLink,
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

    // TEMP to test mobile
    // appLink =
    // RPCTypes.homeAppLinkType.people
    // RPCTypes.homeAppLinkType.chat
    // RPCTypes.homeAppLinkType.files
    // RPCTypes.homeAppLinkType.wallet
    // RPCTypes.homeAppLinkType.git
    // RPCTypes.homeAppLinkType.devices
    // RPCTypes.homeAppLinkType.settings

    const underSettingsMobile = arr => (isMobile ? [Tabs.settingsTab, ...arr] : arr)

    switch (appLink) {
      case RPCTypes.homeAppLinkType.people:
        break
      case RPCTypes.homeAppLinkType.chat:
        dispatch(RouteTree.createSwitchTo({path: [Tabs.chatTab]}))
        break
      case RPCTypes.homeAppLinkType.files:
        dispatch(RouteTree.createSwitchTo({path: underSettingsMobile([Tabs.fsTab])}))
        break
      case RPCTypes.homeAppLinkType.wallet:
        dispatch(RouteTree.createSwitchTo({path: underSettingsMobile([Tabs.walletsTab])}))
        break
      case RPCTypes.homeAppLinkType.git:
        dispatch(RouteTree.createSwitchTo({path: underSettingsMobile([Tabs.gitTab])}))
        break
      case RPCTypes.homeAppLinkType.devices:
        dispatch(RouteTree.createSwitchTo({path: underSettingsMobile([Tabs.devicesTab])}))
        break
      case RPCTypes.homeAppLinkType.settings:
        dispatch(RouteTree.createSwitchTo({path: [Tabs.settingsTab]}))
        break
    }
    // dispatch(PeopleGen.createDismissAnnouncement({id}))
    dispatch(PeopleGen.createGetPeopleData({markViewed: true, numFollowSuggestionsWanted: 10}))
  },
  _onDismiss: id => {
    console.log('aaa TEMP', id)
    // dispatch(PeopleGen.createDismissAnnouncement({id}))
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
