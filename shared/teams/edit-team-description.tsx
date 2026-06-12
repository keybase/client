import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useLoadedTeam} from './team/use-loaded-team'

type Props = {teamID: T.Teams.TeamID}

const EditTeamDescription = (props: Props) => {
  const teamID = props.teamID

  const {teamDetails, teamMeta} = useLoadedTeam(teamID)
  const teamname = teamMeta.teamname
  const waitingKey = C.waitingKeyTeamsTeam(teamID)
  const waiting = C.Waiting.useAnyWaiting(waitingKey)
  const origDescription = teamDetails.description
  const editTeamDescription = C.useRPC(T.RPCGen.teamsSetTeamShowcaseRpcPromise)
  const userEditedRef = React.useRef(false)

  if (teamID === T.Teams.noTeamID) {
    throw new Error(
      `There was a problem loading the description page, please report this error (teamID: ${teamID}, teamname: ${teamname}).`
    )
  }

  const [description, setDescription] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (!userEditedRef.current) {
      setDescription(origDescription)
    }
  }, [origDescription])

  const onSave = () => {
    setError('')
    editTeamDescription(
      [{description, teamID}, waitingKey],
      () => {},
      error => setError(error.message)
    )
  }

  const wasWaitingRef = React.useRef(waiting)
  React.useEffect(() => {
    if (!waiting && wasWaitingRef.current && !error) C.Router2.navigateUp()
  }, [waiting, wasWaitingRef, error])

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
        <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} style={styles.container}>
          <Kb.Input3
            placeholder="Team description"
            onChangeText={value => {
              userEditedRef.current = true
              setDescription(value)
            }}
            value={description}
            multiline={true}
            rowsMin={3}
            rowsMax={3}
            maxLength={280}
            autoFocus={true}
          />
        </Kb.Box2>
      </Kb.ScrollView>
      <Kb.ModalFooter>
        <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
          <Kb.Button label="Cancel" onClick={C.Router2.navigateUp} type="Dim" />
          <Kb.Button
            disabled={description === origDescription}
            label="Save"
            onClick={onSave}
            waiting={waiting}
          />
        </Kb.ButtonBar>
      </Kb.ModalFooter>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  buttonBar: {alignItems: 'center'},
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
  },
}))

export default EditTeamDescription
