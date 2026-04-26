import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {useLoadedTeam} from './use-loaded-team'

type Props = {teamID: T.Teams.TeamID}

const TeamInfo = (props: Props) => {
  const {teamID} = props
  const {teamDetails, teamMeta} = useLoadedTeam(teamID)
  const teamname = teamMeta.teamname
  const lastDot = teamname.lastIndexOf('.')
  const isSubteam = lastDot !== -1
  const _leafName = isSubteam ? teamname.substring(lastDot + 1) : teamname
  const parentTeamNameWithDot = isSubteam ? teamname.substring(0, lastDot + 1) : undefined

  const [draft, setDraft] = React.useState(() => ({
    description: teamDetails.description,
    name: _leafName,
    sourceDescription: teamDetails.description,
    sourceName: _leafName,
  }))
  const hasNewSource = draft.sourceName !== _leafName || draft.sourceDescription !== teamDetails.description
  const newName = hasNewSource ? _leafName : draft.name
  const description = hasNewSource ? teamDetails.description : draft.description
  const setName = (name: string) =>
    setDraft({
      description,
      name: name.replace(/[^a-zA-Z0-9_]/, ''),
      sourceDescription: teamDetails.description,
      sourceName: _leafName,
    })
  const setDescription = (description: string) =>
    setDraft({
      description,
      name: newName,
      sourceDescription: teamDetails.description,
      sourceName: _leafName,
    })
  const [descError, setDescError] = React.useState('')

  const saveDisabled = (description === teamDetails.description && newName === _leafName) || newName.length < 3
  const waiting = C.Waiting.useAnyWaiting([C.waitingKeyTeamsTeam(teamID), C.waitingKeyTeamsRename])
  const renameTeamRPC = C.useRPC(T.RPCGen.teamsTeamRenameRpcPromise)
  const editTeamDescription = C.useRPC(T.RPCGen.teamsSetTeamShowcaseRpcPromise)

  const errors = {
    desc: descError,
    rename: C.Waiting.useAnyErrors(C.waitingKeyTeamsRename)?.message,
  }

  const onSave = () => {
    if (newName !== _leafName) {
      renameTeamRPC(
        [
          {
            newName: {parts: (String(parentTeamNameWithDot) + newName).split('.')},
            prevName: {parts: teamname.split('.')},
          },
          C.waitingKeyTeamsRename,
        ],
        () => {},
        () => {}
      )
    }
    if (description !== teamDetails.description) {
      setDescError('')
      editTeamDescription(
        [{description, teamID}, C.waitingKeyTeamsTeam(teamID)],
        () => {},
        error => setDescError(error.message)
      )
    }
  }
  const navigateAppend = C.Router2.navigateAppend
  const navigateUp = C.Router2.navigateUp
  const onEditAvatar = () =>
    navigateAppend({
      name: 'profileEditAvatar',
      params: {sendChatNotification: true, showBack: true, teamID},
    })

  const wasWaitingRef = React.useRef(waiting)
  React.useEffect(() => {
    if (!waiting && wasWaitingRef.current && !errors.desc && !errors.rename) {
      navigateUp()
    }
  }, [waiting, navigateUp, errors.desc, errors.rename])
  React.useEffect(() => {
    wasWaitingRef.current = waiting
  }, [waiting])

  return (
    <>
      {Object.keys(errors).map(k =>
        errors[k as keyof typeof errors] ? (
          <Kb.Banner color="red" key={k}>
            {errors[k as keyof typeof errors] ?? ''}
          </Kb.Banner>
        ) : null
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.body} gap="tiny">
        <Kb.Avatar
          onClick={onEditAvatar}
          teamname={teamname}
          size={96}
          style={styles.avatar}
        >
          <Kb.Icon type="iconfont-edit" style={styles.editTeamAvatar} />
        </Kb.Avatar>
        {isSubteam ? (
          <Kb.Input3
            autoFocus={true}
            maxLength={16}
            onChangeText={setName}
            {...(parentTeamNameWithDot === undefined ? {} : {prefix: parentTeamNameWithDot})}
            placeholder="subteam"
            value={newName}
            containerStyle={styles.subteamNameInput}
          />
        ) : (
          <Kb.Input3
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
        <Kb.Input3
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
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.Button
            label="Save"
            onClick={onSave}
            fullWidth={true}
            disabled={saveDisabled}
            waiting={waiting}
          />
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatar: {
    alignSelf: 'center',
    marginRight: Kb.Styles.globalMargins.tiny,
  },
  body: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      borderRadius: 4,
    },
    isMobile: {...Kb.Styles.globalStyles.flexOne},
  }),
  editTeamAvatar: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.blue,
      borderColor: Kb.Styles.globalColors.white,
      borderRadius: 100,
      borderStyle: 'solid',
      borderWidth: 2,
      bottom: -6,
      color: Kb.Styles.globalColors.whiteOrWhite,
      padding: 4,
      position: 'absolute',
      right: -6,
    },
  }),
  faded: {opacity: 0.5},
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
  subteamNameInput: Kb.Styles.padding(Kb.Styles.globalMargins.tiny),
}))

export default TeamInfo
