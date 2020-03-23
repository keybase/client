import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Constants from '../../../constants/chat2'
import * as Container from '../../../util/container'
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as TeamConstants from '../../../constants/teams'
import {InfoPanel, Panel} from '.'

type Props = {
  conversationIDKey?: Types.ConversationIDKey
  navigation?: any
}

const InfoPanelConnector = (props: Props) => {
  const storeSelectedTab = Container.useSelector(state => state.chat2.infoPanelSelectedTab)
  const initialTab =
    // @ts-ignore
    typeof props.navigation !== 'undefined' ? Container.getRouteProps(props, 'tab', null) : storeSelectedTab

  const conversationIDKey: Types.ConversationIDKey =
    props.conversationIDKey ??
    Container.getRouteProps(props as any, 'conversationIDKey', Constants.noConversationIDKey)

  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const shouldNavigateOut = meta.conversationIDKey === Constants.noConversationIDKey
  const yourRole = Container.useSelector(state => TeamConstants.getRole(state, meta.teamID))
  const isPreview = meta.membershipType === 'youArePreviewing'
  const channelname = meta.channelname
  const smallTeam = meta.teamType !== 'big'
  const teamname = meta.teamname

  const prevShouldNavigateOut = Container.usePrevious(shouldNavigateOut)
  const [selectedTab, onSelectTab] = React.useState<Panel | null>(initialTab)

  const dispatch = Container.useDispatch()
  const onCancel = () => {
    dispatch(Chat2Gen.createShowInfoPanel({show: false}))
    dispatch(Chat2Gen.createClearAttachmentView({conversationIDKey}))
  }
  const onGoToInbox = React.useCallback(() => dispatch(Chat2Gen.createNavigateToInbox()), [dispatch])

  React.useEffect(() => {
    !prevShouldNavigateOut && shouldNavigateOut && onGoToInbox()
  }, [prevShouldNavigateOut, shouldNavigateOut, onGoToInbox])

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
