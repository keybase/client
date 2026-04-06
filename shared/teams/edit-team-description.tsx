import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

type Props = {teamID: T.Teams.TeamID}

const EditTeamDescription = (props: Props) => {
  const teamID = props.teamID

  const teamname = Teams.useTeamsState(s => Teams.getTeamNameFromID(s, teamID))
  const waitingKey = C.waitingKeyTeamsTeam(teamID)
  const waiting = C.Waiting.useAnyWaiting(waitingKey)
  const origDescription = Teams.useTeamsState(s => s.teamDetails.get(teamID))?.description ?? ''
  const editTeamDescription = C.useRPC(T.RPCGen.teamsSetTeamShowcaseRpcPromise)

  if (teamID === T.Teams.noTeamID || teamname === undefined) {
    throw new Error(
      `There was a problem loading the description page, please report this error (teamID: ${teamID}, teamname: ${teamname}).`
    )
  }

  const [description, setDescription] = React.useState(origDescription)
  const [error, setError] = React.useState('')

  const navigateUp = C.Router2.navigateUp
  const onSave = () => {
    setError('')
    editTeamDescription(
      [{description, teamID}, waitingKey],
      () => {},
      error => setError(error.message)
    )
  }
  const onClose = () => navigateUp()

  const wasWaitingRef = React.useRef(waiting)
  React.useEffect(() => {
    if (!waiting && wasWaitingRef.current && !error) navigateUp()
  }, [waiting, wasWaitingRef, navigateUp, error])

  React.useEffect(() => {
    wasWaitingRef.current = waiting
  }, [waiting])

  return (
    <>
      {error ? (
        <Kb.Banner color="red" key="err">
          {error}
        </Kb.Banner>
      ) : null}
      <Kb.ScrollView alwaysBounceVertical={false} style={Kb.Styles.globalStyles.flexOne}>
        <Kb.Box2 alignItems="center" direction="vertical" style={styles.container}>
          <Kb.Input3
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
      </Kb.ScrollView>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
            <Kb.Button label="Cancel" onClick={onClose} type="Dim" />
            <Kb.Button
              disabled={description === origDescription}
              label="Save"
              onClick={onSave}
              waiting={waiting}
            />
          </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBar: {alignItems: 'center'},
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
    width: '100%',
  },
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      borderStyle: 'solid' as const,
      borderTopColor: Kb.Styles.globalColors.black_10,
      borderTopWidth: 1,
      minHeight: 56,
    },
    isElectron: {
      borderBottomLeftRadius: Kb.Styles.borderRadius,
      borderBottomRightRadius: Kb.Styles.borderRadius,
      overflow: 'hidden',
    },
  }),
}))

export default EditTeamDescription
