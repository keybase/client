import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'
import * as GregorGen from '../actions/gregor-gen'
import * as Tabs from '../constants/tabs'
import openURL from '../util/open-url'
import {
  currentVersion,
  lastVersion,
  lastLastVersion,
  noVersion,
  getSeenVersions,
  anyVersionsUnseen,
  keybaseFM,
} from '../constants/whats-new'
import {Current, Last, LastLast} from './versions'
import WhatsNew from '.'

type OwnProps = {
  // Desktop only: popup.desktop.tsx passes this function to close the popup
  // when navigating within the app
  onBack?: () => void
}

const mapStateToProps = (state: Container.TypedState) => ({
  lastSeenVersion: state.config.whatsNewLastSeenVersion,
})
const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  // Navigate primary/secondary button click
  _onNavigate: ({
    fromKey,
    path,
    replace,
  }: {
    fromKey?: string
    path: Array<{props?: {}; selected: string}>
    replace?: boolean
  }) => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        fromKey,
        path,
        replace,
      })
    )
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
})
const mergeProps = (
  stateProps: ReturnType<typeof mapStateToProps>,
  dispatchProps: ReturnType<typeof mapDispatchToProps>,
  ownProps: OwnProps
) => {
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
    onNavigate: (props: {
      fromKey?: string
      path: Array<{props?: {}; selected: string}>
      replace?: boolean
    }) => {
      dispatchProps._onNavigate(props)
      onBack()
    },
    onNavigateExternal: dispatchProps._onNavigateExternal,
    onSwitchTab: dispatchProps._onSwitchTab,
    seenVersions,
  }
}

WhatsNew.navigationOptions = Container.isMobile
  ? {
      HeaderTitle: keybaseFM,
      header: undefined,
      title: keybaseFM,
    }
  : {}

const WhatsNewContainer = Container.namedConnect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'WhatsNewContainer'
)(WhatsNew)

export default WhatsNewContainer
