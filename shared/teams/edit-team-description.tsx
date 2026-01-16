import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {ModalTitle} from './common'
import {useSafeNavigation} from '@/util/safe-navigation'

type Props = {teamID: T.Teams.TeamID}

const EditTeamDescription = (props: Props) => {
  const teamID = props.teamID

  const teamname = Teams.useTeamsState(s => Teams.getTeamNameFromID(s, teamID))
  const waitingKey = C.waitingKeyTeamsTeam(teamID)
  const waiting = C.Waiting.useAnyWaiting(waitingKey)
  const error = Teams.useTeamsState(s => s.errorInEditDescription)
  const origDescription = Teams.useTeamsState(s => s.teamDetails.get(teamID))?.description ?? ''

  if (teamID === T.Teams.noTeamID || teamname === undefined) {
    throw new Error(
      `There was a problem loading the description page, please report this error (teamID: ${teamID}, teamname: ${teamname}).`
    )
  }

  const [description, setDescription] = React.useState(origDescription)
  const editTeamDescription = Teams.useTeamsState(s => s.dispatch.editTeamDescription)

  const nav = useSafeNavigation()
  const onSave = () => editTeamDescription(teamID, description)
  const onClose = () => nav.safeNavigateUp()

  const wasWaitingRef = React.useRef(waiting)
  React.useEffect(() => {
    if (!waiting && wasWaitingRef.current && !error) nav.safeNavigateUp()
  }, [waiting, wasWaitingRef, nav, error])

  React.useEffect(() => {
    wasWaitingRef.current = waiting
  }, [waiting])

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

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBar: {alignItems: 'center'},
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
    width: '100%',
  },
  headerIcon: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, 0, 0),
  title: {
    paddingBottom: Kb.Styles.globalMargins.medium,
    paddingTop: Kb.Styles.globalMargins.xtiny,
  },
}))

export default EditTeamDescription

