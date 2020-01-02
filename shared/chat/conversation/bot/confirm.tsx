import * as React from 'react'
import * as Container from '../../../util/container'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Kb from '../../../common-adapters'
import * as Constants from '../../../constants/chat2'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as TeamTypes from '../../../constants/types/teams'

type LoaderProps = Container.RouteProps<{
  botUsername: string
  conversationIDKey?: Types.ConversationIDKey
  teamID?: TeamTypes.TeamID
}>

const ConfirmBotRemoveLoader = (props: LoaderProps) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const inConvIDKey = Container.getRouteProps(props, 'conversationIDKey', undefined)
  const teamID = Container.getRouteProps(props, 'teamID', undefined)
  const [conversationIDKey, setConversationIDKey] = React.useState(inConvIDKey)
  const generalConvID = Container.useSelector(
    (state: Container.TypedState) => teamID && state.chat2.teamIDToGeneralConvID.get(teamID)
  )
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (!conversationIDKey && teamID) {
      if (!generalConvID) {
        dispatch(Chat2Gen.createFindGeneralConvIDFromTeamID({teamID}))
      } else {
        setConversationIDKey(generalConvID)
      }
    }
  }, [conversationIDKey, dispatch, generalConvID, teamID])
  return <ConfirmBotRemove botUsername={botUsername} conversationIDKey={conversationIDKey} />
}

type Props = {
  botUsername: string
  conversationIDKey?: Types.ConversationIDKey
}

const ConfirmBotRemove = (props: Props) => {
  const {botUsername, conversationIDKey} = props
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onRemove = conversationIDKey
    ? () => {
        dispatch(Chat2Gen.createRemoveBotMember({conversationIDKey, username: botUsername}))
      }
    : undefined
  return (
    <Kb.ConfirmModal
      prompt={`Are you sure you want to uninstall ${botUsername}?`}
      waitingKey={Constants.waitingKeyBotRemove}
      onConfirm={onRemove}
      onCancel={onClose}
      description=""
      header={<Kb.Avatar username={botUsername} size={96} />}
    />
  )
}

export default ConfirmBotRemoveLoader
