import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Electron from 'electron'
import * as Tabs from '../../constants/tabs'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as FsGen from '../../actions/fs-gen'
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
import {isLinux} from '../../constants/platform'
import openURL from '../../util/open-url'
import {quit} from '../../desktop/app/ctl.desktop'
import {tabRoots} from '../routes'

type OwnProps = {
  navigation: any
  selectedTab: Tabs.AppTab
}

export default Container.connect(
  (state: Container.TypedState) => ({
    _justSignedUpEmail: state.signup.justSignedUpEmail,
    _settingsEmailBanner: state.settings.email.addedEmail,
    badgeNumbers: state.notifications.navBadges,
    fsCriticalUpdate: state.fs.criticalUpdate,
    fullname: TrackerConstants.getDetails(state, state.config.username).fullname || '',
    username: state.config.username,
  }),
  (dispatch, ownProps: OwnProps) => ({
    _onProfileClick: (username: string) => dispatch(ProfileGen.createShowUserProfile({username})),
    _onTabClick: (
      tab: Tabs.Tab,
      fsCriticalUpdate: boolean,
      justSignedUpEmail: string,
      settingsEmailBanner?: string
    ) => {
      if (ownProps.selectedTab === Tabs.peopleTab && tab !== Tabs.peopleTab) {
        dispatch(PeopleGen.createMarkViewed())
      }
      if (ownProps.selectedTab !== Tabs.chatTab && tab === Tabs.chatTab) {
        dispatch(Chat2Gen.createTabSelected())
      }
      // Clear "just signed up email" when you leave the people tab after signup
      if (justSignedUpEmail && ownProps.selectedTab === Tabs.peopleTab && tab !== Tabs.peopleTab) {
        dispatch(SignupGen.createClearJustSignedUpEmail())
      }
      // Clear "check your inbox" in settings when you leave the settings tab
      if (settingsEmailBanner && ownProps.selectedTab === Tabs.settingsTab && tab !== Tabs.settingsTab) {
        dispatch(SettingsGen.createClearAddedEmail())
      }
      // Clear critical update when we nav away from tab
      if (fsCriticalUpdate && ownProps.selectedTab === Tabs.fsTab && tab !== Tabs.fsTab) {
        dispatch(FsGen.createSetCriticalUpdate({val: false}))
      }
      if (ownProps.selectedTab === tab) {
        ownProps.navigation.navigate(tabRoots[tab])
      } else {
        ownProps.navigation.navigate(tab)
      }
    },
    onAddAccount: () => dispatch(ProvisionGen.createStartProvision()),
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
      Electron.remote.getCurrentWindow().hide()
      setTimeout(() => {
        quit()
      }, 2000)
    },
    onSettings: () => dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab})),
    onSignOut: () => dispatch(RouteTreeGen.createNavigateAppend({path: [SettingsConstants.logOutTab]})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    badgeNumbers: stateProps.badgeNumbers,
    fsCriticalUpdate: stateProps.fsCriticalUpdate,
    fullname: stateProps.fullname,
    onAddAccount: dispatchProps.onAddAccount,
    onHelp: dispatchProps.onHelp,
    onProfileClick: () => dispatchProps._onProfileClick(stateProps.username),
    onQuit: dispatchProps.onQuit,
    onSettings: dispatchProps.onSettings,
    onSignOut: dispatchProps.onSignOut,
    onTabClick: (tab: Tabs.AppTab) =>
      dispatchProps._onTabClick(
        tab,
        stateProps.fsCriticalUpdate,
        stateProps._justSignedUpEmail,
        stateProps._settingsEmailBanner
      ),
    selectedTab: ownProps.selectedTab,
    username: stateProps.username,
  })
)(TabBar)
