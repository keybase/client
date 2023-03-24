import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Styles from '../../styles'
import {ModalTitle} from '../common'
import * as Types from '../../constants/types/teams'
import * as TeamsGen from '../../actions/teams-gen'

type Props = Container.RouteProps<'teamEditTeamInfo'>

const TeamInfo = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamID = props.route.params?.teamID ?? Types.noTeamID
  const teamMeta = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const teamDetails = Container.useSelector(s => Constants.getTeamDetails(s, teamID))

  const teamname = teamMeta.teamname
  const lastDot = teamname.lastIndexOf('.')
  const isSubteam = lastDot !== -1
  const _leafName = isSubteam ? teamname.substr(lastDot + 1) : teamname
  const parentTeamNameWithDot = isSubteam ? teamname.substr(0, lastDot + 1) : undefined

  const [newName, _setName] = React.useState(_leafName)
  const setName = (newName: string) => _setName(newName.replace(/[^a-zA-Z0-9_]/, ''))
  const [description, setDescription] = React.useState(teamDetails.description)

  const saveDisabled =
    (description === teamDetails.description && newName === _leafName) || newName.length < 3
  const waiting = Container.useAnyWaiting(Constants.teamWaitingKey(teamID), Constants.teamRenameWaitingKey)

  const errors = {
    desc: Container.useSelector(state => state.teams.errorInEditDescription),
    rename: Container.useAnyErrors(Constants.teamRenameWaitingKey)?.message,
  }

  const onBack = () => dispatch(nav.safeNavigateUpPayload())
  const onSave = () => {
    if (newName !== _leafName) {
      dispatch(TeamsGen.createRenameTeam({newName: parentTeamNameWithDot + newName, oldName: teamname}))
    }
    if (description !== teamDetails.description) {
      dispatch(TeamsGen.createEditTeamDescription({description, teamID}))
    }
  }
  const onEditAvatar = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [{props: {sendChatNotification: true, showBack: true, teamID}, selected: 'profileEditAvatar'}],
      })
    )
  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onBack}
      header={{
        leftButton: Styles.isMobile ? <Kb.Icon type="iconfont-arrow-left" onClick={onBack} /> : undefined,
        title: <ModalTitle teamID={teamID} title={isSubteam ? 'Edit subteam info' : 'Edit team info'} />,
      }}
      footer={{
        content: (
          <Kb.Button
            label="Save"
            onClick={onSave}
            fullWidth={true}
            disabled={saveDisabled}
            waiting={waiting}
          />
        ),
      }}
      banners={
        <>
          {Object.keys(errors).map(k =>
            errors[k] ? (
              <Kb.Banner color="red" key={k}>
                {errors[k]}
              </Kb.Banner>
            ) : null
          )}
        </>
      }
      allowOverflow={true}
      backgroundStyle={styles.bg}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.body} gap="tiny">
        <Kb.Avatar
          editable={true}
          onEditAvatarClick={onEditAvatar}
          teamname={teamname}
          size={96}
          style={styles.avatar}
        />
        {isSubteam ? (
          <Kb.NewInput
            autoFocus={true}
            maxLength={16}
            onChangeText={setName}
            prefix={parentTeamNameWithDot}
            placeholder="subteam"
            value={newName}
            containerStyle={styles.subteamNameInput}
          />
        ) : (
          <Kb.LabeledInput
            containerStyle={styles.faded}
            maxLength={16}
            onChangeText={setName}
            disabled={true}
            placeholder="Team name"
            value={teamname}
          />
        )}
        <Kb.Text type="BodySmall">
          {isSubteam ? `Subteam names are private.` : `Team names can't be changed.`}
        </Kb.Text>
        <Kb.LabeledInput
          hoverPlaceholder={isSubteam ? 'What is this subteam about?' : 'What is your team about?'}
          placeholder="Description"
          value={description}
          autoFocus={!isSubteam}
          rowsMin={3}
          rowsMax={3}
          multiline={true}
          onChangeText={setDescription}
          maxLength={280}
        />
        {/* TODO: location */}
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  avatar: {
    alignSelf: 'center',
    marginBottom: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
  bg: {backgroundColor: Styles.globalColors.blueGrey},
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Styles.globalMargins.small,
  },
  faded: {opacity: 0.5},
  subteamNameInput: Styles.padding(Styles.globalMargins.tiny),
  wordBreak: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default TeamInfo
