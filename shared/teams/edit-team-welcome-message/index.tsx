import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as T from '../../constants/types'
import {computeWelcomeMessageTextRaw} from '../../chat/conversation/messages/cards/team-journey/util'

type Props = {teamID: T.Teams.TeamID}

// welcomeMessageMaxLen is duplicated at
// go/chat/server.go:welcomeMessageMaxLen; keep the values in sync!
const welcomeMessageMaxLen = 400

const EditTeamWelcomeMessage = (props: Props) => {
  const teamID = props.teamID ?? T.Teams.noTeamID

  if (teamID === T.Teams.noTeamID) {
    throw new Error(`There was a problem loading the welcome message page, please report this error.`)
  }

  const waitingKey = Constants.setWelcomeMessageWaitingKey(teamID)
  const waiting = Container.useAnyWaiting(waitingKey)
  const error = C.useTeamsState(s => s.errorInEditWelcomeMessage)
  const origWelcomeMessage = C.useTeamsState(s => s.teamIDToWelcomeMessage.get(teamID))

  const [welcomeMessage, setWelcomeMessage] = React.useState({
    raw: origWelcomeMessage?.raw ?? '',
    set: origWelcomeMessage?.set ?? true,
  })
  const showNoWelcomeMessage = welcomeMessage.set && welcomeMessage.raw.length === 0

  const _setWelcomeMessage = C.useTeamsState(s => s.dispatch.setWelcomeMessage)
  const nav = Container.useSafeNavigation()
  const onSave = () => _setWelcomeMessage(teamID, welcomeMessage)
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
            <Kb.Button style={styles.button} label="Cancel" onClick={onClose} type="Dim" />
            <Kb.Button
              style={styles.button}
              disabled={
                welcomeMessage.raw === origWelcomeMessage?.raw &&
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
          onChangeText={x => setWelcomeMessage({raw: x, set: true})}
          value={computeWelcomeMessageTextRaw(welcomeMessage, false /* cannotWrite */)}
          multiline={true}
          rowsMin={3}
          rowsMax={Styles.isMobile ? 8 : 3}
          maxLength={welcomeMessageMaxLen}
          autoFocus={true}
        />
        {(!Styles.isMobile || showNoWelcomeMessage) && (
          <Kb.Text
            type="BodySmall"
            style={Styles.collapseStyles([
              styles.info,
              !(welcomeMessage.set && welcomeMessage.raw.length === 0) && {visibility: 'hidden' as const},
            ] as any)}
          >
            No welcome note will be shown to new members.
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  button: {
    width: '50%',
  },
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
