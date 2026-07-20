import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useLoadedTeam} from './team/use-loaded-team'
import {useNavUpWhenDone} from './common/use-nav-up-when-done'

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

  useNavUpWhenDone(waiting, error)

  return (
    <>
      <Kb.ErrorBanner error={error} />
      <Kb.ScrollView alwaysBounceVertical={false} style={Kb.Styles.globalStyles.flexOne}>
        <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} padding="small">
          <Kb.Input3
            textType="BodySemibold"
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
        <Kb.ConfirmButtons
          waiting={waiting}
          onCancel={C.Router2.navigateUp}
          onConfirm={onSave}
          confirmLabel="Save"
          confirmDisabled={description === origDescription}
        />
      </Kb.ModalFooter>
    </>
  )
}

export default EditTeamDescription
