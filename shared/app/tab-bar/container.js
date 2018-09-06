// @flow
import {connect, type TypedState, isMobile} from '../../util/container'
import TabBarRender from '.'
import {chatTab, peopleTab, profileTab, type Tab} from '../../constants/tabs'
import {navigateTo, switchTo} from '../../actions/route-tree'
import {createShowUserProfile} from '../../actions/profile-gen'

let KeyHandler = c => c
if (!isMobile) {
  KeyHandler = require('../../util/key-handler.desktop').default
}

const mapStateToProps = (state: TypedState) => ({
  _badgeNumbers: state.notifications.get('navBadges'),
  username: state.config.username,
})

const mapDispatchToProps = (dispatch, {routeSelected, routePath}) => ({
  _onTabClick: isMobile
    ? (tab: Tab, me: ?string) => {
        if (tab === chatTab && routeSelected === tab) {
          dispatch(navigateTo(routePath.push(tab)))
          return
        }

        // If we're going to the people tab, switch to the current user's
        // profile first before switching tabs, if necessary.
        if (tab === peopleTab) {
          if (routeSelected === tab) {
            // clicking on profile tab when already selected should back out to root profile page
            dispatch(navigateTo([], [peopleTab]))
          }
          dispatch(switchTo([peopleTab]))
          return
        }

        const action = routeSelected === tab ? navigateTo : switchTo
        dispatch(action(routePath.push(tab)))
      }
    : (tab: Tab, me: ?string) => {
        if (tab === chatTab && routeSelected === tab) {
          // clicking the chat tab when already selected should do nothing.
          return
        }

        // If we're going to the people tab, switch to the current user's
        // people first before switching tabs, if necessary.
        if (tab === peopleTab) {
          if (routeSelected === tab) {
            // clicking on people tab when already selected should back out to root people page
            dispatch(navigateTo([], [peopleTab]))
          }
          dispatch(switchTo([peopleTab]))
          return
        }

        // profileTab = self avatar in bottom left corner
        // On click switch to people tab and push current user onto people route stack
        if (tab === profileTab) {
          me && dispatch(createShowUserProfile({username: me}))
          return
        }

        // otherwise, back out to the default route of the tab.
        const action = routeSelected === tab ? navigateTo : switchTo
        dispatch(action(routePath.push(tab)))
      },
})

const mergeProps = (stateProps, dispatchProps, {routeSelected}) => ({
  badgeNumbers: stateProps._badgeNumbers.toObject(),
  onTabClick: (tab: Tab) => dispatchProps._onTabClick(tab, stateProps.username),
  selectedTab: routeSelected,
  username: stateProps.username || '',
})

const ConnectedTabBar = connect(mapStateToProps, mapDispatchToProps, mergeProps)(TabBarRender)
export default (isMobile ? ConnectedTabBar : KeyHandler(ConnectedTabBar))
