import * as Constants from '../../../constants/chat2'
import * as React from 'react'
import * as TeamConstants from '../../../constants/teams'
import type * as Types from '../../../constants/types/chat2'
import {InfoPanel, type Panel} from '.'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  navigation?: any
} & Partial<{
  conversationIDKey: Types.ConversationIDKey
  tab?: 'settings' | 'members' | 'attachments' | 'bots'
}>

const InfoPanelConnector = (props: Props) => {
  const storeSelectedTab = Constants.useState(s => s.infoPanelSelectedTab)
  const initialTab = props.tab ?? storeSelectedTab

  const conversationIDKey: Types.ConversationIDKey =
    props.conversationIDKey ?? props.conversationIDKey ?? Constants.noConversationIDKey

  const meta = Constants.useConvoState(conversationIDKey, s => s.meta)
  const shouldNavigateOut = meta.conversationIDKey === Constants.noConversationIDKey
  const yourRole = TeamConstants.useState(s => TeamConstants.getRole(s, meta.teamID))
  const isPreview = meta.membershipType === 'youArePreviewing'
  const channelname = meta.channelname
  const smallTeam = meta.teamType !== 'big'
  const teamname = meta.teamname

  const [selectedTab, onSelectTab] = React.useState<Panel | undefined>(initialTab)
  const [lastSNO, setLastSNO] = React.useState(shouldNavigateOut)

  const showInfoPanel = Constants.useState(s => s.dispatch.showInfoPanel)
  const clearAttachmentView = Constants.useConvoState(conversationIDKey, s => s.dispatch.clearAttachmentView)
  const onCancel = () => {
    showInfoPanel(false, undefined, conversationIDKey)
    clearAttachmentView()
  }
  const onGoToInbox = Constants.useState(s => s.dispatch.navigateToInbox)

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
      selectedConversationIDKey={conversationIDKey}
      selectedTab={selectedTab ?? 'members'}
      smallTeam={smallTeam}
      teamname={teamname}
      yourRole={yourRole}
    />
  )
}

export default InfoPanelConnector
