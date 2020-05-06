import * as React from 'react'
import upperFirst from 'lodash/upperFirst'
import * as Types from '../../../constants/types/teams'
import * as ChatTypes from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as ChatConstants from '../../../constants/chat2'
import * as TeamsGen from '../../../actions/teams-gen'
import {useChannelMeta} from '../../common/channel-hooks'
import {ChannelEditor, errorBanner} from './common'

type EditProps = Container.RouteProps<{
  conversationIDKey: ChatTypes.ConversationIDKey
  teamID: Types.TeamID
  // Defaults to true - if set, it's a standalone modal that closes on save
  standalone: boolean
}>

const EditChannel = (props: EditProps) => {
  const conversationIDKey = Container.getRouteProps(
    props,
    'conversationIDKey',
    ChatConstants.noConversationIDKey
  )
  if (!conversationIDKey) {
    throw new Error('conversationIDKey unexpectedly empty')
  }
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  if (!teamID) {
    throw new Error('teamID unexpectedly empty')
  }

  const standalone = Container.getRouteProps(props, 'standalone', true)

  const conversationMeta = useChannelMeta(teamID, conversationIDKey)
  const initialChannelName = conversationMeta ? conversationMeta.channelname : ''
  const initialTopic = conversationMeta ? conversationMeta.description : ''

  const [channelName, setChannelName] = React.useState(initialChannelName)
  const prevInitialChannelNameRef = React.useRef('')
  React.useEffect(() => {
    if (initialChannelName && initialChannelName !== prevInitialChannelNameRef.current) {
      setChannelName(initialChannelName)
    }
  }, [initialChannelName, setChannelName])
  React.useEffect(() => {
    prevInitialChannelNameRef.current = channelName
  }, [initialChannelName])

  const [topic, setTopic] = React.useState(initialTopic)
  const prevInitialTopicRef = React.useRef('')
  React.useEffect(() => {
    if (initialTopic && initialTopic !== prevInitialTopicRef.current) {
      setTopic(initialTopic)
    }
  }, [initialTopic, setTopic])
  React.useEffect(() => {
    prevInitialTopicRef.current = topic
  }, [initialTopic])

  const nav = Container.useSafeNavigation()
  const dispatch = Container.useDispatch()
  const onSubmit = React.useCallback(() => {
    if (channelName !== 'general' && channelName !== initialChannelName) {
      dispatch(TeamsGen.createSetChannelCreationError({error: ''}))
      dispatch(TeamsGen.createUpdateChannelName({conversationIDKey, newChannelName: channelName, teamID}))
    }
    if (topic !== initialTopic) {
      dispatch(TeamsGen.createUpdateTopic({conversationIDKey, newTopic: topic, teamID}))
    }
    dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
    return
  }, [channelName, initialChannelName, topic, initialTopic, teamID])
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [standalone, dispatch])
  const onClose = React.useCallback(() => {
    if (standalone) {
      dispatch(nav.safeNavigateUpPayload())
    }
  }, [standalone])

  const errorText = Container.useSelector(state => upperFirst(state.teams.errorInChannelCreation))

  const waiting = Container.useAnyWaiting(Constants.updateChannelNameWaitingKey(teamID))
  const prevWaitingRef = React.useRef(false)
  React.useEffect(() => {
    if (!waiting && prevWaitingRef.current && !errorText) {
      dispatch(nav.safeNavigateUpPayload())
    }
  }, [dispatch, waiting, prevWaitingRef, errorText])
  React.useEffect(() => {
    prevWaitingRef.current = waiting
  }, [waiting, prevWaitingRef])

  const banners = React.useMemo(() => errorBanner(errorText), [errorText])

  return (
    <ChannelEditor
      mode="edit"
      title={initialChannelName ? `#${initialChannelName}` : 'Loading...'}
      deleteRenameDisabled={channelName === 'general'}
      teamID={teamID}
      loading={conversationMeta == null}
      channelName={channelName}
      onChangeChannelName={setChannelName}
      topic={topic}
      onChangeTopic={setTopic}
      onBack={!standalone ? onBack : undefined}
      onClose={standalone ? onClose : undefined}
      onSubmit={onSubmit}
      banners={banners}
      waiting={waiting}
    />
  )
}

export default EditChannel
