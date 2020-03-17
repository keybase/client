import * as React from 'react'
import * as ChatTypes from '../../constants/types/chat2'
import * as TeamsTypes from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import {useAllChannelMetas} from '../common/channel-hooks'
import {pluralize} from '../../util/string'

type Props = Container.RouteProps<{
  teamID: TeamsTypes.TeamID
}>

const Header = () => (
  <>
    <Kb.Icon type={'icon-teams-channel-64'} />
    <Kb.Icon type="icon-team-delete-28" style={{marginRight: -60, marginTop: -20, zIndex: 1}} />
  </>
)

const getTeamSelectedCount = (state: Container.TypedState, teamID: TeamsTypes.TeamID) => {
  return state.teams.teamSelectedChannels.get(teamID)
}

const DeleteChannel = (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', TeamsTypes.noTeamID)
  const channelIDs = Container.useSelector(state => getTeamSelectedCount(state, teamID))

  if (channelIDs == undefined) {
    throw new Error('conversationIDKeys unexpectedly empty')
  }

  const channels = useAllChannelMetas(teamID)
  var channelnames: string[] = []

  channelIDs.forEach(channelID => {
    const conversationMeta = channels?.get(channelID)
    const channelname = conversationMeta ? conversationMeta.channelname : ''
    channelnames.push(channelname)
  })

  var deleteMsg: string
  if (channelnames.length == 1) {
    deleteMsg = `#${channelnames[0]}`
  } else if (channelnames.length == 2) {
    deleteMsg = `#${channelnames[0]} and #${channelnames[1]}`
  } else if (channelnames.length == 3) {
    deleteMsg = `#${channelnames[0]}, #${channelnames[1]} and #${channelnames[2]}`
  } else {
    const numOtherChans = channelnames.length - 3
    deleteMsg = `#${channelnames[0]}, #${channelnames[1]}, #${
      channelnames[2]
    } and ${numOtherChans} other ${pluralize('channel', numOtherChans)}`
  }

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onDelete = () => {
    dispatch(
      TeamsGen.createDeleteMultiChannelsConfirmed({
        channels: channelIDs,
        teamID,
      })
    )
    dispatch(
      TeamsGen.createSetChannelSelected({
        channel: '',
        clearAll: true,
        selected: false,
        teamID: teamID,
      })
    )
  }

  const onClose = () => dispatch(nav.safeNavigateUpPayload())

  return (
    <Kb.ConfirmModal
      confirmText={`Delete ${pluralize('channel', channelnames.length)}`}
      description="This cannot be undone. All messages in the channel will be lost."
      header={<Header />}
      onCancel={onClose}
      onConfirm={onDelete}
      prompt={`Delete ${deleteMsg}?`}
    />
  )
}

export default DeleteChannel
