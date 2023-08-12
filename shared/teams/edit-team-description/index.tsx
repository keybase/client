import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {ModalTitle} from '../common'

type Props = {teamID: Types.TeamID}

const EditTeamDescription = (props: Props) => {
  const teamID = props.teamID ?? Types.noTeamID

  const teamname = C.useTeamsState(s => Constants.getTeamNameFromID(s, teamID))
  const waitingKey = Constants.teamWaitingKey(teamID)
  const waiting = Container.useAnyWaiting(waitingKey)
  const error = C.useTeamsState(s => s.errorInEditDescription)
  const origDescription = C.useTeamsState(s => s.teamDetails.get(teamID))?.description ?? ''

  if (teamID === Types.noTeamID || teamname === null) {
    throw new Error(
      `There was a problem loading the description page, please report this error (teamID: ${teamID}, teamname: ${teamname}).`
    )
  }

  const [description, setDescription] = React.useState(origDescription)
  const editTeamDescription = C.useTeamsState(s => s.dispatch.editTeamDescription)

  const nav = Container.useSafeNavigation()
  const onSave = () => editTeamDescription(teamID, description)
  const onClose = () => nav.safeNavigateUp()

  const wasWaiting = Container.usePrevious(waiting)
  React.useEffect(() => {
    if (!waiting && wasWaiting && !error) nav.safeNavigateUp()
  }, [waiting, wasWaiting, nav, error])

  return (
    <Kb.Modal
      mode="Default"
      banners={
        error ? (
          <Kb.Banner color="red" key="err">
            {error}
          </Kb.Banner>
        ) : null
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
      header={{title: <ModalTitle teamID={teamID} title="Edit team description" />}}
      allowOverflow={true}
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
