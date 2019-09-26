import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'
import * as GregorGen from '../actions/gregor-gen'
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

const mapStateToProps = (state: Container.TypedState) => ({
  lastSeenVersion: state.config.whatsNewLastSeenVersion,
})
const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  // Navigate primary/secondary button click
  _onNavigate: (props: {}, selected: string) => {
    if (Object.keys(props).length) {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props, selected}],
        })
      )
    } else {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [selected],
        })
      )
    }
  },
  _onNavigateExternal: (url: string) => openURL(url),

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
  dispatchProps: ReturnType<typeof mapDispatchToProps>
) => {
  const seenVersions = getSeenVersions(stateProps.lastSeenVersion)
  const newRelease = anyVersionsUnseen(stateProps.lastSeenVersion)
  return {
    Current,
    Last,
    LastLast,
    currentVersion,
    lastLastVersion,
    lastVersion,
    noVersion,
    onBack: () => {
      if (newRelease) {
        dispatchProps._onUpdateLastSeenVersion(currentVersion)
      }
    },
    onNavigate: dispatchProps._onNavigate,
    onNavigateExternal: dispatchProps._onNavigateExternal,
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
