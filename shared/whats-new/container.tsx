import * as ConfigConstants from '../constants/config'
import * as RouterConstants from '../constants/router2'
import type * as Tabs from '../constants/tabs'
import openURL from '../util/open-url'
import {currentVersion, useState} from '../constants/whats-new'
import {Current, Last, LastLast} from './versions'
import type {PathParam} from '../constants/types/route-tree'
import WhatsNew from '.'

type OwnProps = {
  // Desktop only: popup.desktop.tsx passes this function to close the popup
  // when navigating within the app
  onBack?: () => void
}

const WhatsNewContainer = (ownProps: OwnProps) => {
  const _onNavigateExternal = (url: string) => {
    openURL(url)
  }
  const switchTab = RouterConstants.useState(s => s.dispatch.switchTab)
  const _onSwitchTab = (tab: Tabs.AppTab) => {
    switchTab(tab)
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
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const props = {
    Current,
    Last,
    LastLast,
    onBack,
    // Navigate then handle setting seen state and closing the modal (desktop only)
    onNavigate: (props: PathParam) => {
      navigateAppend(props)
      onBack()
    },
    onNavigateExternal: _onNavigateExternal,
    onSwitchTab: _onSwitchTab,
    seenVersions,
  }
  return <WhatsNew {...props} />
}

export default WhatsNewContainer
