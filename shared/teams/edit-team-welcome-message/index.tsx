import React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as TeamsGen from '../../actions/teams-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import {computeWelcomeMessageText} from '../../chat/conversation/messages/cards/team-journey/util'

type Props = Container.RouteProps<{teamID: Types.TeamID}>

// welcomeMessageMaxLen is duplicated at
// go/chat/server.go:welcomeMessageMaxLen; keep the values in sync!
const welcomeMessageMaxLen = 400

const EditTeamWelcomeMessage = (props: Props) => {
  const teamID = Container.getRouteProps(props, 'teamID', Types.noTeamID)

  const waitingKey = Container.useSelector(_ => Constants.loadWelcomeMessageWaitingKey(teamID))
  const waiting = Container.useAnyWaiting(waitingKey)
  const error = Container.useSelector(state => state.teams.errorInEditWelcomeMessage)
  const origWelcomeMessage = Container.useSelector(
    state => Constants.getTeamWelcomeMessageByID(state, teamID)!
  )

  if (teamID === Types.noTeamID) {
    throw new Error(`There was a problem loading the welcome message page, please report this error.`)
  }

  const [welcomeMessage, setWelcomeMessage] = React.useState(origWelcomeMessage)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onSave = () => {
    dispatch(TeamsGen.createSetWelcomeMessage({message: welcomeMessage, teamID}))
    dispatch(nav.safeNavigateUpPayload())
  }
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
            <Kb.Button style={{width: '50%'}} label="Cancel" onClick={onClose} type="Dim" />
            <Kb.Button
              style={{width: '50%'}}
              disabled={
                welcomeMessage.text === origWelcomeMessage.text &&
                welcomeMessage.set === origWelcomeMessage.set
              }
              label="Save"
              onClick={onSave}
              waiting={waiting}
            />
          </Kb.ButtonBar>
        ),
      }}
      header={{
        title: 'Edit welcome note',
      }}
    >
      <Kb.Box2 alignItems="flex-start" direction="vertical" style={styles.container}>
        <Kb.LabeledInput
          placeholder="Welcome note"
          onChangeText={x => setWelcomeMessage({set: true, text: x})}
          value={computeWelcomeMessageText(welcomeMessage, false /* cannotWrite */)}
          multiline={true}
          rowsMin={3}
          rowsMax={3}
          maxLength={welcomeMessageMaxLen}
          autoFocus={true}
        />
        <Kb.Text type="BodySmall" style={styles.info}>
          {welcomeMessage.set && welcomeMessage.text.length === 0 ? (
            'No welcome note will be shown to new members.'
          ) : (
            <>&nbsp;</>
          )}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  buttonBar: {
    alignItems: 'center',
    minHeight: undefined,
  },
  container: {
    ...Styles.padding(Styles.globalMargins.small),
    backgroundColor: Styles.globalColors.blueGrey,
    paddingBottom: Styles.globalMargins.large,
    width: '100%',
  },
  info: {
    paddingTop: Styles.globalMargins.tiny,
  },
  title: {
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.xtiny,
  },
}))

export default EditTeamWelcomeMessage
