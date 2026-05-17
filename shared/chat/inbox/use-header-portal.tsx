import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import {createPortal} from 'react-dom'
import SearchRow from './search-row'
import {useInboxHeaderPortalNode, setInboxHeaderPortalContent} from './header-portal-state'
import type {InboxSearchController} from './use-inbox-search'

export default function useInboxHeaderPortal(search: InboxSearchController) {
  const portalNode = useInboxHeaderPortalNode()

  const content = React.useMemo(
    () => <SearchRow forceShowFilter={true} search={search} showNewChatButton={true} showSearch={true} />,
    [search]
  )

  React.useEffect(() => {
    if (!Styles.isMobile || !C.isTablet) return
    setInboxHeaderPortalContent(content)
  }, [content])

  React.useEffect(() => {
    if (!Styles.isMobile || !C.isTablet) return
    return () => {
      setInboxHeaderPortalContent(null)
    }
  }, [])

  if (!Styles.isMobile) {
    return portalNode ? createPortal(content, portalNode) : null
  }

  return null
}
