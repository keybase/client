import * as T from '@/constants/types'
import UnfurlGenericView from './generic-view'
import {useActions} from './use-state'

function UnfurlGeneric(p: {
  ordinal: T.Chat.Ordinal
  unfurlInfo: T.RPCChat.UIMessageUnfurlInfo
  youAreAuthor: boolean
}) {
  const {ordinal, unfurlInfo, youAreAuthor} = p
  const {isCollapsed, unfurl, unfurlMessageID} = unfurlInfo
  const {onClose, onToggleCollapse} = useActions(
    youAreAuthor,
    T.Chat.numberToMessageID(unfurlMessageID),
    ordinal
  )
  const generic = unfurl.unfurlType === T.RPCChat.UnfurlType.generic ? unfurl.generic : undefined
  if (!generic || generic.mapInfo) {
    return null
  }
  const {description, publishTime, favicon, media, siteName, title, url} = generic

  return (
    <UnfurlGenericView
      description={description ?? undefined}
      favicon={favicon ?? undefined}
      isCollapsed={isCollapsed}
      media={media ?? undefined}
      onClose={onClose}
      onToggleCollapse={onToggleCollapse}
      publishTime={publishTime ?? undefined}
      siteName={siteName}
      title={title}
      url={url}
    />
  )
}

export default UnfurlGeneric
