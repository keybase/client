import * as C from '@/constants'
import * as React from 'react'
import InboxHeaderControls from './header-controls'
import {setInboxHeaderPortalContent} from './header-portal-state'
import type {InboxSearchController} from './use-inbox-search'

export default function useInboxHeaderPortal(search: InboxSearchController) {
  const content = C.isTablet ? <InboxHeaderControls search={search} /> : null

  React.useEffect(() => {
    if (!C.isTablet) {
      return
    }
    setInboxHeaderPortalContent(content)
    return () => {
      setInboxHeaderPortalContent(null)
    }
  }, [content])

  return null
}
