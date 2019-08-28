import * as React from 'react'
import * as Kb from '../../../../common-adapters/mobile.native'

type Props = {
  onHidden: () => void
  onInsertSlashCommand: () => void
  onRequestLumens?: () => void
  onSendLumens?: () => void
  onShareLocation: (length: number) => void
  visible: boolean
}

const MoreMenuPopup = (props: Props) => {
  const [showingLocation, setShowingLocation] = React.useState(false)
  const items = [
    ...(props.onSendLumens ? [{onClick: props.onSendLumens, title: 'Send Lumens (XLM)'}] : []),
    ...(props.onRequestLumens ? [{onClick: props.onRequestLumens, title: 'Request Lumens (XLM)'}] : []),
    {onClick: props.onInsertSlashCommand, title: 'Insert a slash command'},
    {onClick: () => setShowingLocation(true), title: 'Share your location'},
  ]
  return (
    <Kb.FloatingMenu closeOnSelect={true} items={items} onHidden={props.onHidden} visible={props.visible} />
  )
}

export default MoreMenuPopup
