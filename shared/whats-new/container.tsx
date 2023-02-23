import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'
import * as GregorGen from '../actions/gregor-gen'
import type * as Tabs from '../constants/tabs'
import openURL from '../util/open-url'
import {
  currentVersion,
  lastVersion,
  lastLastVersion,
  noVersion,
  getSeenVersions,
  anyVersionsUnseen,
} from '../constants/whats-new'
import {Current, Last, LastLast} from './versions'
import WhatsNew from '.'
import type {NavigateAppendPayload} from '../actions/route-tree-gen'

type OwnProps = {
  // Desktop only: popup.desktop.tsx passes this function to close the popup
  // when navigating within the app
  onBack?: () => void
}

const WhatsNewContainer = Container.connect(
  (state: Container.TypedState) => ({
    lastSeenVersion: state.config.whatsNewLastSeenVersion,
  }),
  (dispatch: Container.TypedDispatch) => ({
    // Navigate primary/secondary button click

    _onNavigate: (props: NavigateAppendPayload['payload']) => {
      dispatch(RouteTreeGen.createNavigateAppend(props))
    },

    _onNavigateExternal: (url: string) => openURL(url),

    _onSwitchTab: (tab: Tabs.AppTab) => dispatch(RouteTreeGen.createSwitchTab({tab})),

    _onUpdateLastSeenVersion: (lastSeenVersion: string) => {
      const action = GregorGen.createUpdateCategory({
        body: lastSeenVersion,
        category: 'whatsNewLastSeenVersion',
      })
      dispatch(action)
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const seenVersions = getSeenVersions(stateProps.lastSeenVersion)
    const newRelease = anyVersionsUnseen(stateProps.lastSeenVersion)
    const onBack = () => {
      if (newRelease) {
        dispatchProps._onUpdateLastSeenVersion(currentVersion)
      }
      if (ownProps.onBack) {
        ownProps.onBack()
      }
    }
    return {
      Current,
      Last,
      LastLast,
      currentVersion,
      lastLastVersion,
      lastVersion,
      noVersion,
      onBack,
      // Navigate then handle setting seen state and closing the modal (desktop only)
      onNavigate: (props: NavigateAppendPayload['payload']) => {
        dispatchProps._onNavigate(props)
        onBack()
      },
      onNavigateExternal: dispatchProps._onNavigateExternal,
      onSwitchTab: dispatchProps._onSwitchTab,
      seenVersions,
    }
  }
)(WhatsNew)

export default WhatsNewContainer
