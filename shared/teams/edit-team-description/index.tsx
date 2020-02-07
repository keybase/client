import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as TeamsGen from '../../actions/teams-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'

type Props = Container.RouteProps<{teamID: Types.TeamID}>

const EditTeamDescription = (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)

  const teamname = Container.useSelector(state => Constants.getTeamNameFromID(state, teamID))
  const waitingKey = Container.useSelector(state => Constants.teamWaitingKeyByID(teamID, state))
  const waiting = Container.useAnyWaiting(waitingKey)
  const error = Container.useSelector(state => state.teams.errorInEditDescription)
  const origDescription = Container.useSelector(state => Constants.getTeamDetails(state, teamID).description)

  if (teamID === Types.noTeamID || teamname === null) {
    throw new Error(
      `There was a problem loading the description page, please report this error (teamID: ${teamID}, teamname: ${teamname}).`
    )
  }

  const [description, setDescription] = React.useState(origDescription)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onSave = () => dispatch(TeamsGen.createEditTeamDescription({description, teamID}))
  const onClose = () => dispatch(nav.safeNavigateUpPayload())

  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    if (!waiting && wasWaiting && !error) dispatch(nav.safeNavigateUpPayload())
  }, [waiting, wasWaiting, nav, dispatch, error])

  return (
    <Kb.Modal
      mode="Default"
      banners={
        error
          ? [
              <Kb.Banner color="red" key="err">
                {error}
              </Kb.Banner>,
            ]
          : undefined
      }
      onClose={onClose}
      footer={{
        content: (
          <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
            <Kb.Button label="Cancel" onClick={onClose} type="Dim" />
            <Kb.Button
              disabled={description === origDescription}
              label="Save"
              onClick={onSave}
              waiting={waiting}
            />
          </Kb.ButtonBar>
        ),
      }}
      header={{
        icon: (
          <Kb.Box style={styles.headerIcon}>
            <Kb.Avatar isTeam={true} teamname={teamname} size={64} />
          </Kb.Box>
        ),
        title: teamname,
      }}
    >
      <Kb.Box2 alignItems="center" direction="vertical" style={styles.container}>
        <Kb.LabeledInput
          placeholder="Team description"
          onChangeText={setDescription}
          value={description}
          multiline={true}
          rowsMin={3}
          rowsMax={3}
          maxLength={280}
          autoFocus={true}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  buttonBar: {alignItems: 'center'},
  container: {
    ...Styles.padding(Styles.globalMargins.small),
    width: '100%',
  },
  headerIcon: Styles.padding(Styles.globalMargins.tiny, 0, 0),
  title: {
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.xtiny,
  },
}))

export default EditTeamDescription
