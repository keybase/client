// @flow
import * as I from 'immutable'
import * as Chat2Gen from '../../actions/chat2-gen'
import {connect, isMobile} from '../../util/container'
import TabBarRender from '.'
import {chatTab, peopleTab, profileTab, walletsTab, type Tab} from '../../constants/tabs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {createShowUserProfile} from '../../actions/profile-gen'

type OwnProps = {|
  hotkeys?: Array<string>,
  onHotkey?: (cmd: string) => void,
  routeSelected: Tab,
  routePath: I.List<string>,
|}

let KeyHandler: any = c => c
if (!isMobile) {
  KeyHandler = require('../../util/key-handler.desktop').default
}

const mapStateToProps = state => ({
  _badgeNumbers: state.notifications.get('navBadges'),
  isWalletsNew: state.chat2.isWalletsNew,
  username: state.config.username,
})

const mapDispatchToProps = (dispatch, {routeSelected, routePath}) => ({
  _onTabClick: isMobile
    ? (tab: Tab, me: ?string, isWalletsNew: boolean) => {
        if (tab === chatTab && routeSelected === tab) {
          dispatch(RouteTreeGen.createNavigateTo({path: routePath.push(tab)}))
          return
        }

        // If we're going to the people tab, switch to the current user's
        // profile first before switching tabs, if necessary.
        if (tab === peopleTab) {
          if (routeSelected === tab) {
            // clicking on profile tab when already selected should back out to root profile page
            dispatch(RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: []}))
          }
          dispatch(RouteTreeGen.createSwitchTo({path: [peopleTab]}))
          return
        }

        if (routeSelected === tab) {
          dispatch(RouteTreeGen.createNavigateTo({path: routePath.push(tab)}))
        } else {
          dispatch(RouteTreeGen.createSwitchTo({path: routePath.push(tab)}))
        }
      }
    : (tab: Tab, me: ?string, isWalletsNew: boolean) => {
        if (tab === chatTab && routeSelected === tab) {
          // clicking the chat tab when already selected should do nothing.
          return
        }

        // If we're going to the people tab, switch to the current user's
        // people first before switching tabs, if necessary.
        if (tab === peopleTab) {
          if (routeSelected === tab) {
            // clicking on people tab when already selected should back out to root people page
            dispatch(RouteTreeGen.createNavigateTo({parentPath: [peopleTab], path: []}))
          }
          dispatch(RouteTreeGen.createSwitchTo({path: [peopleTab]}))
          return
        }

        // profileTab = self avatar in bottom left corner
        // On click switch to people tab and push current user onto people route stack
        if (tab === profileTab) {
          me && dispatch(createShowUserProfile({username: me}))
          return
        }

        // If we're going to the Wallets tab and it's badged new, unbadge it.
        if (tab === walletsTab && isWalletsNew) {
          dispatch(Chat2Gen.createHandleSeeingWallets())
        }

        // otherwise, back out to the default route of the tab.
        if (routeSelected === tab) {
          dispatch(RouteTreeGen.createNavigateTo({path: routePath.push(tab)}))
        } else {
          dispatch(RouteTreeGen.createSwitchTo({path: routePath.push(tab)}))
        }
      },
})

const mergeProps = (stateProps, dispatchProps, {routeSelected}) => ({
  badgeNumbers: stateProps._badgeNumbers.toObject(),
  isNew: {
    [walletsTab]: stateProps.isWalletsNew,
  },
  onTabClick: (tab: Tab) => dispatchProps._onTabClick(tab, stateProps.username, stateProps.isWalletsNew),
  selectedTab: routeSelected,
  username: stateProps.username || '',
})

const ConnectedTabBar = connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(TabBarRender)
export default (isMobile ? ConnectedTabBar : KeyHandler(ConnectedTabBar))
