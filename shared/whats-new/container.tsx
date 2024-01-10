import * as C from '@/constants'
import openURL from '@/util/open-url'
import {currentVersion} from '@/constants/whats-new'
import {Current, Last, LastLast} from './versions'
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
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const _onSwitchTab = (tab: C.Tabs.AppTab) => {
    switchTab(tab)
  }

  const updateGregorCategory = C.useConfigState(s => s.dispatch.updateGregorCategory)
  const _onUpdateLastSeenVersion = (lastSeenVersion: string) => {
    updateGregorCategory('whatsNewLastSeenVersion', lastSeenVersion)
  }
  const seenVersions = C.useWNState(s => s.getSeenVersions())
  const newRelease = C.useWNState(s => s.anyVersionsUnseen())
  const onBack = () => {
    if (newRelease) {
      _onUpdateLastSeenVersion(currentVersion)
    }
    if (ownProps.onBack) {
      ownProps.onBack()
    }
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const props = {
    Current,
    Last,
    LastLast,
    onBack,
    // Navigate then handle setting seen state and closing the modal (desktop only)
    onNavigate: (props: C.Router2.PathParam) => {
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
