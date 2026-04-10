import {createPortal} from 'react-dom'
import InboxHeaderControls from './header-controls'
import {useInboxHeaderPortalNode} from './header-portal-state'
import type {InboxSearchController} from './use-inbox-search'

export default function useInboxHeaderPortal(search: InboxSearchController) {
  const portalNode = useInboxHeaderPortalNode()
  return portalNode ? createPortal(<InboxHeaderControls search={search} />, portalNode) : null
}
