import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters/mobile.native'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'

type Props = {
  locationAccuracy?: number
  locationMap?: string
  onHidden: () => void
  onInsertSlashCommand: () => void
  onRequestLumens?: () => void
  onSendLumens?: () => void
  visible: boolean
}

const MoreMenuPopup = (props: Props) => {
  const dispatch = Container.useDispatch()
  const onLocationShare = React.useCallback(() => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {namespace: 'chat2'}, selected: 'chatLocationPreview'}],
      })
    )
  }, [dispatch])
  const items = [
    ...(props.onSendLumens ? [{onClick: props.onSendLumens, title: 'Send Lumens (XLM)'}] : []),
    ...(props.onRequestLumens ? [{onClick: props.onRequestLumens, title: 'Request Lumens (XLM)'}] : []),
    {onClick: props.onInsertSlashCommand, title: 'Insert a slash command'},
    {onClick: onLocationShare, title: 'Share your location'},
  ]
  return (
    <Kb.FloatingMenu closeOnSelect={true} items={items} onHidden={props.onHidden} visible={props.visible} />
  )
}

export default MoreMenuPopup
