import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as TeamsTypes from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import CreateChannels from '../new-team/wizard/create-channels'

type Props = Container.RouteProps<{teamID: TeamsTypes.TeamID}>

export default (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', TeamsTypes.noTeamID)
  const dispatch = Container.useDispatch()
  const [waiting, error] = Container.useSelector(s => [
    s.teams.creatingChannels,
    s.teams.errorInChannelCreation,
  ])
  const prevWaiting = Container.usePrevious(waiting)
  const success = prevWaiting && !waiting && !error

  const banners = [
    ...(error
      ? [
          <Kb.Banner color="red" key="error" style={styles.banner}>
            {error}
          </Kb.Banner>,
        ]
      : success
      ? [
          <Kb.Banner color="green" key="success" style={styles.banner}>
            Successfully created channels.
          </Kb.Banner>,
        ]
      : []),
  ]

  const onSubmitChannels = (channels: Array<string>) => {
    dispatch(
      TeamsGen.createCreateChannels({
        channelnames: channels,
        teamID,
      })
    )
  }
  return (
    <CreateChannels onSubmitChannels={onSubmitChannels} teamID={teamID} waiting={waiting} banners={banners} />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  banner: {
    position: 'absolute',
    top: 47,
    zIndex: 1,
  },
}))
