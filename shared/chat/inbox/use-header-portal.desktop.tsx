import {createPortal} from 'react-dom'
import SearchRow from '@/chat/inbox/search-row'
import {useInboxHeaderPortalNode} from '@/chat/inbox/header-portal-state'
import type {InboxSearchController} from '@/chat/inbox/use-inbox-search'

export default function useInboxHeaderPortal(search: InboxSearchController) {
  const portalNode = useInboxHeaderPortalNode()
  return portalNode
    ? createPortal(<SearchRow forceShowFilter={true} search={search} showNewChatButton={true} showSearch={true} />, portalNode)
    : null
}
