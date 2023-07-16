import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'
import * as ConfigConstants from '../constants/config'
import type * as Tabs from '../constants/tabs'
import openURL from '../util/open-url'
import {currentVersion, useState} from '../constants/whats-new'
import {Current, Last, LastLast} from './versions'
import WhatsNew from '.'
import type {NavigateAppendPayload} from '../actions/route-tree-gen'

type OwnProps = {
  // Desktop only: popup.desktop.tsx passes this function to close the popup
  // when navigating within the app
  onBack?: () => void
}

const WhatsNewContainer = (ownProps: OwnProps) => {
  const dispatch = Container.useDispatch()
  const _onNavigate = (props: NavigateAppendPayload['payload']) => {
    dispatch(RouteTreeGen.createNavigateAppend(props))
  }

  const _onNavigateExternal = (url: string) => {
    openURL(url)
  }
  const _onSwitchTab = (tab: Tabs.AppTab) => {
    dispatch(RouteTreeGen.createSwitchTab({tab}))
  }

  const updateGregorCategory = ConfigConstants.useConfigState(s => s.dispatch.updateGregorCategory)
  const _onUpdateLastSeenVersion = (lastSeenVersion: string) => {
    updateGregorCategory('whatsNewLastSeenVersion', lastSeenVersion)
  }
  const seenVersions = useState(s => s.getSeenVersions())
  const newRelease = useState(s => s.anyVersionsUnseen())
  const onBack = () => {
    if (newRelease) {
      _onUpdateLastSeenVersion(currentVersion)
    }
    if (ownProps.onBack) {
      ownProps.onBack()
    }
  }
  const props = {
    Current,
    Last,
    LastLast,
    onBack,
    // Navigate then handle setting seen state and closing the modal (desktop only)
    onNavigate: (props: NavigateAppendPayload['payload']) => {
      _onNavigate(props)
      onBack()
    },
    onNavigateExternal: _onNavigateExternal,
    onSwitchTab: _onSwitchTab,
    seenVersions,
  }
  return <WhatsNew {...props} />
}

export default WhatsNewContainer
