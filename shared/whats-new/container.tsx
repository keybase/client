import * as C from '@/constants'
import openURL from '@/util/open-url'
import {currentVersion} from '@/stores/whats-new'
import {Current, Last, LastLast} from './versions'
import WhatsNew from '.'
import {useWhatsNewState as useWNState} from '@/stores/whats-new'
import {useConfigState} from '@/stores/config'

const WhatsNewContainer = () => {
  const _onNavigateExternal = (url: string) => {
    openURL(url)
  }
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const _onSwitchTab = (tab: C.Tabs.AppTab) => {
    switchTab(tab)
  }

  const updateGregorCategory = useConfigState(s => s.dispatch.updateGregorCategory)
  const _onUpdateLastSeenVersion = (lastSeenVersion: string) => {
    updateGregorCategory('whatsNewLastSeenVersion', lastSeenVersion)
  }
  const seenVersions = useWNState(s => s.seenVersions)
  const newRelease = useWNState(s => s.anyVersionsUnseen())
  const onBack = () => {
    if (newRelease) {
      _onUpdateLastSeenVersion(currentVersion)
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
