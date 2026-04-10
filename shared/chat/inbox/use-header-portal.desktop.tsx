import {createPortal} from 'react-dom'
import SearchRow from './search-row'
import {useInboxHeaderPortalNode} from './header-portal-state'
import type {InboxSearchController} from './use-inbox-search'

export default function useInboxHeaderPortal(search: InboxSearchController) {
  const portalNode = useInboxHeaderPortalNode()
  return portalNode
    ? createPortal(<SearchRow forceShowFilter={true} search={search} showNewChatButton={true} showSearch={true} />, portalNode)
    : null
}
