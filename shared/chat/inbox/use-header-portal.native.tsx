import * as C from '@/constants'
import * as React from 'react'
import SearchRow from './search-row'
import {setInboxHeaderPortalContent} from './header-portal-state'
import type {InboxSearchController} from './use-inbox-search'

export default function useInboxHeaderPortal(search: InboxSearchController) {
  const content = React.useMemo(
    () => <SearchRow forceShowFilter={true} search={search} showNewChatButton={true} showSearch={true} />,
    [search]
  )

  React.useEffect(() => {
    if (!C.isTablet) {
      return
    }
    setInboxHeaderPortalContent(content)
  }, [content])

  React.useEffect(() => {
    if (!C.isTablet) {
      return
    }
    return () => {
      setInboxHeaderPortalContent(null)
    }
  }, [])

  return null
}
