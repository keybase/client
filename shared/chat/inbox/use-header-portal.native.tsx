import * as C from '@/constants'
import * as React from 'react'
import SearchRow from './search-row'
import {setInboxHeaderPortalContent} from './header-portal-state'
import type {InboxSearchController} from './use-inbox-search'

export default function useInboxHeaderPortal(search: InboxSearchController) {
  React.useEffect(() => {
    if (!C.isTablet) {
      return
    }
    setInboxHeaderPortalContent(
      <SearchRow forceShowFilter={true} search={search} showNewChatButton={true} showSearch={true} />
    )
    return () => {
      setInboxHeaderPortalContent(null)
    }
  }, [search])

  return null
}
