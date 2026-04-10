import Inbox from '.'
import {useInboxSearch} from './use-inbox-search'

export default function InboxRoot() {
  const search = useInboxSearch()

  return <Inbox search={search} />
}
