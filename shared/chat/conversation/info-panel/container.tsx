import * as C from '../../../constants'
import * as React from 'react'
import * as TeamConstants from '../../../constants/teams'
import type * as Types from '../../../constants/types/chat2'
import {InfoPanel, type Panel} from '.'

type Props = {
  conversationIDKey: Types.ConversationIDKey // for page
  navigation?: any
} & Partial<{
  conversationIDKey: Types.ConversationIDKey // for page
  tab?: 'settings' | 'members' | 'attachments' | 'bots'
}>

const InfoPanelConnector = (props: Props) => {
  const storeSelectedTab = C.useChatState(s => s.infoPanelSelectedTab)
  const initialTab = props.tab ?? storeSelectedTab
  const conversationIDKey = C.useChatContext(s => s.id)
  const meta = C.useConvoState(conversationIDKey, s => s.meta)
  const shouldNavigateOut = meta.conversationIDKey === C.noConversationIDKey
  const yourRole = C.useTeamsState(s => TeamConstants.getRole(s, meta.teamID))
  const isPreview = meta.membershipType === 'youArePreviewing'
  const channelname = meta.channelname
  const smallTeam = meta.teamType !== 'big'
  const teamname = meta.teamname

  const [selectedTab, onSelectTab] = React.useState<Panel | undefined>(initialTab)
  const [lastSNO, setLastSNO] = React.useState(shouldNavigateOut)

  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const clearAttachmentView = C.useConvoState(conversationIDKey, s => s.dispatch.clearAttachmentView)
  const onCancel = () => {
    showInfoPanel(false, undefined)
    clearAttachmentView()
  }
  const onGoToInbox = C.useChatState(s => s.dispatch.navigateToInbox)

  if (lastSNO !== shouldNavigateOut) {
    setLastSNO(shouldNavigateOut)
    if (!lastSNO && shouldNavigateOut) {
      onGoToInbox()
    }
  }

  return (
    <InfoPanel
      onCancel={onCancel}
      onSelectTab={onSelectTab}
      channelname={channelname}
      isPreview={isPreview}
      selectedTab={selectedTab ?? 'members'}
      smallTeam={smallTeam}
      teamname={teamname}
      yourRole={yourRole}
    />
  )
}

export default InfoPanelConnector
