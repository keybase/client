import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as React from 'react'
import * as TeamConstants from '../../../constants/teams'
import type * as Types from '../../../constants/types/chat2'
import {InfoPanel, type Panel} from '.'

type Props = {
  conversationIDKey?: Types.ConversationIDKey
  navigation?: any
} & Partial<{
  conversationIDKey?: Types.ConversationIDKey
  tab?: 'settings' | 'members' | 'attachments' | 'bots'
}>

const InfoPanelConnector = (props: Props) => {
  const storeSelectedTab = Constants.useState(s => s.infoPanelSelectedTab)
  const initialTab = props.tab ?? storeSelectedTab

  const conversationIDKey: Types.ConversationIDKey =
    props.conversationIDKey ?? props.conversationIDKey ?? Constants.noConversationIDKey

  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const shouldNavigateOut = meta.conversationIDKey === Constants.noConversationIDKey
  const yourRole = TeamConstants.useState(s => TeamConstants.getRole(s, meta.teamID))
  const isPreview = meta.membershipType === 'youArePreviewing'
  const channelname = meta.channelname
  const smallTeam = meta.teamType !== 'big'
  const teamname = meta.teamname

  const [selectedTab, onSelectTab] = React.useState<Panel | undefined>(initialTab)
  const [lastSNO, setLastSNO] = React.useState(shouldNavigateOut)

  const dispatch = Container.useDispatch()
  const showInfoPanel = Constants.useState(s => s.dispatch.showInfoPanel)
  const onCancel = () => {
    showInfoPanel(false)
    dispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
  }
  const onGoToInbox = React.useCallback(() => dispatch(Chat2Gen.createNavigateToInbox()), [dispatch])

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
