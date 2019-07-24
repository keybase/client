import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Tabs from '../../constants/tabs'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as ConfigGen from '../../actions/config-gen'
import * as PeopleGen from '../../actions/people-gen'
import * as ProfileGen from '../../actions/profile-gen'
import * as ProvisionGen from '../../actions/provision-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as SettingsGen from '../../actions/settings-gen'
import * as SignupGen from '../../actions/signup-gen'
import * as SettingsConstants from '../../constants/settings'
import * as TrackerConstants from '../../constants/tracker2'
import TabBar from './index.desktop'
import * as Container from '../../util/container'
import {memoize} from '../../util/memoize'
import {isLinux} from '../../constants/platform'
import openURL from '../../util/open-url'
import {quit, hideWindow} from '../../util/quit-helper'
import {tabRoots} from '../routes'

type OwnProps = {
  navigation: any
  selectedTab: Tabs.AppTab
}

const mapStateToProps = (state: Container.TypedState) => ({
  _badgeNumbers: state.notifications.navBadges,
  _fullnames: state.users.infoMap,
  _peopleJustSignedUpEmail: state.signup.justSignedUpEmail,
  _settingsEmailBanner: state.settings.email.addedEmail,
  configuredAccounts: state.config.configuredAccounts,
  fullname: TrackerConstants.getDetails(state, state.config.username).fullname || '',
  isWalletsNew: state.chat2.isWalletsNew,
  uploading: state.fs.uploads.syncingPaths.count() > 0 || state.fs.uploads.writingToJournal.count() > 0,
  username: state.config.username,
})

const mapDispatchToProps = (dispatch, ownProps) => ({
  _onProfileClick: username => dispatch(ProfileGen.createShowUserProfile({username})),
  _onTabClick: (tab, peopleJustSignedUpEmail, settingsEmailBanner) => {
    if (ownProps.selectedTab === Tabs.peopleTab && tab !== Tabs.peopleTab) {
      dispatch(PeopleGen.createMarkViewed())
    }
    if (ownProps.selectedTab !== Tabs.chatTab && tab === Tabs.chatTab) {
      dispatch(Chat2Gen.createTabSelected())
    }

    // Clear "just signed up email" when you leave the people tab after signup
    if (peopleJustSignedUpEmail && ownProps.selectedTab === Tabs.peopleTab && tab !== Tabs.peopleTab) {
      dispatch(SignupGen.createClearJustSignedUpEmail())
    }
    // Clear "check your inbox" in settings when you leave the settings tab
    if (settingsEmailBanner && ownProps.selectedTab === Tabs.settingsTab && tab !== Tabs.settingsTab) {
      dispatch(SettingsGen.createClearAddedEmail())
    }

    if (ownProps.selectedTab === tab) {
      ownProps.navigation.navigate(tabRoots[tab])
    } else {
      ownProps.navigation.navigate(tab)
    }
  },
  onAddAccount: () => dispatch(ProvisionGen.createStartProvision()),
  onCreateAccount: () => dispatch(SignupGen.createRequestAutoInvite()), // TODO make this route
  onHelp: () => openURL('https://keybase.io/docs'),
  onQuit: () => {
    if (!__DEV__) {
      if (isLinux) {
        dispatch(SettingsGen.createStop({exitCode: RPCTypes.ExitCode.ok}))
      } else {
        dispatch(ConfigGen.createDumpLogs({reason: 'quitting through menu'}))
      }
    }
    // In case dump log doesn't exit for us
    hideWindow()
    setTimeout(() => {
      quit('quitButton')
    }, 2000)
  },
  onSettings: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab})),
  onSignOut: () => dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsConstants.logOutTab]})),
})

const getBadges = memoize(b => b.toObject())

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => ({
  badgeNumbers: getBadges(stateProps._badgeNumbers),
  fullname: stateProps.fullname,
  isWalletsNew: stateProps.isWalletsNew,
  onAddAccount: dispatchProps.onAddAccount,
  onCreateAccount: dispatchProps.onCreateAccount,
  onHelp: dispatchProps.onHelp,
  onProfileClick: () => dispatchProps._onProfileClick(stateProps.username),
  onQuit: dispatchProps.onQuit,
  onSettings: dispatchProps.onSettings,
  onSignOut: dispatchProps.onSignOut,
  onTabClick: (tab: Tabs.AppTab) =>
    dispatchProps._onTabClick(tab, stateProps._peopleJustSignedUpEmail, stateProps._settingsEmailBanner),
  selectedTab: ownProps.selectedTab,
  uploading: stateProps.uploading,
  username: stateProps.username,
})

export default Container.connect(mapStateToProps, mapDispatchToProps, mergeProps)(TabBar)
