import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'
import * as GregorGen from '../actions/gregor-gen'
import * as ConfigGen from '../actions/config-gen'
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
import {isLinux} from '../constants/platform'
import {Current, Last, LastLast} from './versions'
import WhatsNew from '.'

type OwnProps = {
  // Desktop only: popup.desktop.tsx passes this function to close the popup
  // when navigating within the app
  onBack?: () => void
}

WhatsNew.navigationOptions = Container.isMobile
  ? {
      HeaderTitle: keybaseFM,
      header: undefined,
      title: keybaseFM,
    }
  : {}

const WhatsNewContainer = Container.namedConnect(
  (state: Container.TypedState) => ({
    lastSeenVersion: state.config.whatsNewLastSeenVersion,
    updateAvailable: state.config.updateInfo.status === 'suggested',
    updateMessage:
      isLinux && state.config.updateInfo.status === 'suggested'
        ? state.config.updateInfo?.suggested?.message
        : '',
  }),
  (dispatch: Container.TypedDispatch) => ({
    // Navigate primary/secondary button click
    _onNavigate: (p: {fromKey?: string; path: Array<{props?: {}; selected: string}>; replace?: boolean}) => {
      const {fromKey, path, replace} = p
      dispatch(
        RouteTreeGen.createNavigateAppend({
          fromKey,
          path,
          replace,
        })
      )
    },

    _onNavigateExternal: (url: string) => openURL(url),

    _onUpdateLastSeenVersion: (lastSeenVersion: string) => {
      dispatch(
        GregorGen.createUpdateCategory({
          body: lastSeenVersion,
          category: 'whatsNewLastSeenVersion',
        })
      )
    },

    _onUpdateSnooze: () => {
      // TODO @jacob PICNIC-684 - Add snoozing RPC
      // TODO @jacob PICNIC-684 - Handle linux "never notify"
    },
    _onUpdateStart: () => {
      // Linux clients have never had an `updater` bundled with them (keybase/go-updater)
      // Attempting to make this RPC without an updater will black bar the GUI
      !isLinux && dispatch(ConfigGen.createUpdateStart())
    },
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {updateAvailable, updateMessage, lastSeenVersion} = stateProps
    const seenVersions = getSeenVersions(lastSeenVersion)
    const newRelease = anyVersionsUnseen(lastSeenVersion)
    const onBack = () => {
      if (newRelease) {
        dispatchProps._onUpdateLastSeenVersion(currentVersion)
      }
      if (ownProps.onBack) {
        ownProps.onBack()
      }
    }
    // Navigate then handle setting seen state and closing the modal (desktop only)
    const onNavigate = (props: {
      fromKey?: string
      path: Array<{Props?: {}; selected: string}>
      replace?: boolean
    }) => {
      dispatchProps._onNavigate(props)
      onBack()
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
      onNavigate,
      onNavigateExternal: dispatchProps._onNavigateExternal,
      onUpdateSnooze: dispatchProps._onUpdateSnooze,
      onUpdateStart: dispatchProps._onUpdateStart,
      seenVersions,
      updateAvailable,
      updateMessage,
    }
  },
  'WhatsNewContainer'
)(WhatsNew)

export default WhatsNewContainer
