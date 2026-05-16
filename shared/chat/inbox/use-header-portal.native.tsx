import * as C from '@/constants'
import * as React from 'react'
import SearchRow from '@/chat/inbox/search-row'
import {setInboxHeaderPortalContent} from '@/chat/inbox/header-portal-state'
import type {InboxSearchController} from '@/chat/inbox/use-inbox-search'

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
