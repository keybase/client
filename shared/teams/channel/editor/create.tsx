import * as React from 'react'
import upperFirst from 'lodash/upperFirst'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import * as Constants from '../../../constants/teams'
import * as TeamsGen from '../../../actions/teams-gen'
import {ChannelEditor, errorBanner} from './common'

type EditProps = Container.RouteProps<{
  teamID: Types.TeamID
  // Defaults to true - if set, it's a standalone modal that closes on save
  standalone: boolean
}>

const CreateChannel = (props: EditProps) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)
  if (!teamID) {
    throw new Error('teamID unexpectedly empty')
  }
  const standalone = Container.getRouteProps(props, 'standalone', true)

  const [channelName, setChannelName] = React.useState('')
  const [topic, setTopic] = React.useState('')

  const nav = Container.useSafeNavigation()
  const dispatch = Container.useDispatch()
  const onSubmit = React.useCallback(() => {
    dispatch(
      TeamsGen.createCreateChannel({
        channelname: channelName,
        description: topic,
        navToChatOnSuccess: standalone,
        teamID,
      })
    )
    dispatch(TeamsGen.createLoadTeamChannelList({teamID}))
    return
  }, [dispatch, standalone, channelName, topic, teamID])
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  const onClose = React.useCallback(() => {
    standalone && dispatch(nav.safeNavigateUpPayload())
  }, [dispatch, nav, standalone])

  const errorText = Container.useSelector(state => upperFirst(state.teams.errorInChannelCreation))

  const waiting = Container.useAnyWaiting(Constants.createChannelWaitingKey(teamID))
  const prevWaitingRef = React.useRef(false)
  React.useEffect(() => {
    if (!waiting && prevWaitingRef.current && !errorText) {
      dispatch(nav.safeNavigateUpPayload())
    }
  }, [dispatch, waiting, nav, prevWaitingRef, errorText])
  React.useEffect(() => {
    prevWaitingRef.current = waiting
  }, [waiting, prevWaitingRef])

  const banners = React.useMemo(() => errorBanner(errorText), [errorText])

  return (
    <ChannelEditor
      mode="create"
      title="New channel"
      teamID={teamID}
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

export default CreateChannel
