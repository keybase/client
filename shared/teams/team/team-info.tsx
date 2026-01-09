import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {ModalTitle} from '../common'
import {useSafeNavigation} from '@/util/safe-navigation'

type Props = {teamID: T.Teams.TeamID}

const TeamInfo = (props: Props) => {
  const nav = useSafeNavigation()
  const {teamID} = props
  const teamMeta = Teams.useTeamsState(s => Teams.getTeamMeta(s, teamID))
  const teamDetails = Teams.useTeamsState(s => s.teamDetails.get(teamID))
  const teamname = teamMeta.teamname
  const lastDot = teamname.lastIndexOf('.')
  const isSubteam = lastDot !== -1
  const _leafName = isSubteam ? teamname.substring(lastDot + 1) : teamname
  const parentTeamNameWithDot = isSubteam ? teamname.substring(0, lastDot + 1) : undefined

  const [newName, _setName] = React.useState(_leafName)
  const setName = (newName: string) => _setName(newName.replace(/[^a-zA-Z0-9_]/, ''))
  const [description, setDescription] = React.useState(teamDetails?.description ?? '')

  const saveDisabled =
    (description === teamDetails?.description && newName === _leafName) || newName.length < 3
  const waiting = C.Waiting.useAnyWaiting([C.waitingKeyTeamsTeam(teamID), C.waitingKeyTeamsRename])

  const errors = {
    desc: Teams.useTeamsState(s => s.errorInEditDescription),
    rename: C.Waiting.useAnyErrors(C.waitingKeyTeamsRename)?.message,
  }

  const editTeamDescription = Teams.useTeamsState(s => s.dispatch.editTeamDescription)
  const renameTeam = Teams.useTeamsState(s => s.dispatch.renameTeam)
  const onBack = () => nav.safeNavigateUp()
  const onSave = () => {
    if (newName !== _leafName) {
      renameTeam(teamname, parentTeamNameWithDot + newName)
    }
    if (description !== teamDetails?.description) {
      editTeamDescription(teamID, description)
    }
  }
  const onEditAvatar = () =>
    nav.safeNavigateAppend({
      props: {sendChatNotification: true, showBack: true, teamID},
      selected: 'profileEditAvatar',
    })
  return (
    <Kb.Modal
      mode="DefaultFullHeight"
      onClose={onBack}
      header={{
        leftButton: Kb.Styles.isMobile ? <Kb.Icon type="iconfont-arrow-left" onClick={onBack} /> : undefined,
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
            errors[k as keyof typeof errors] ? (
              <Kb.Banner color="red" key={k}>
                {errors[k as keyof typeof errors] ?? ''}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatar: {
    alignSelf: 'center',
    marginBottom: Kb.Styles.globalMargins.tiny,
    marginRight: Kb.Styles.globalMargins.tiny,
  },
  bg: {backgroundColor: Kb.Styles.globalColors.blueGrey},
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  container: {
    padding: Kb.Styles.globalMargins.small,
  },
  faded: {opacity: 0.5},
  subteamNameInput: Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
  wordBreak: Kb.Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

export default TeamInfo
