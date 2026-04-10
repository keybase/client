import * as C from '@/constants'
import * as React from 'react'
import InboxHeaderControls from './header-controls'
import {setInboxHeaderPortalContent} from './header-portal-state'
import type {InboxSearchController} from './use-inbox-search'

export default function useInboxHeaderPortal(search: InboxSearchController) {
  React.useEffect(() => {
    if (!C.isTablet) {
      return
    }
    setInboxHeaderPortalContent(<InboxHeaderControls search={search} />)
    return () => {
      setInboxHeaderPortalContent(null)
    }
  }, [search])

  return null
}
