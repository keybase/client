import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import openUrl from '@/util/open-url'
import upperFirst from 'lodash/upperFirst'

const openSubteamInfo = () => openUrl('https://book.keybase.io/docs/teams/design')

type Props = {
  baseTeam?: string // if set we're creating a subteam of this teamname
  errorText: string
  onCancel: () => void
  onClearError: () => void
  onSubmit: (fullName: string, joinSubteam: boolean) => void
}

// used in chat too
export const CreateNewTeam = (props: Props) => {
  const [name, setName] = React.useState('')
  const [joinSubteam, setJoinSubteam] = React.useState(true)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsCreation)

  const {baseTeam, onSubmit} = props
  const isSubteam = !!baseTeam

  const onSubmitCb = React.useCallback(
    () => (isSubteam ? onSubmit(baseTeam + '.' + name, joinSubteam) : onSubmit(name, false)),
    [isSubteam, baseTeam, onSubmit, name, joinSubteam]
  )
  const disabled = name.length < 2

  // clear error we may have hit on unmount
  const {onClearError} = props
  React.useEffect(() => () => onClearError(), [onClearError])

  const modalHeader = Kb.useModalHeaderTitleAndCancel('Create a team', props.onCancel)

  return (
    <Kb.Modal
      banners={
        <>
          {!isSubteam ? (
            <Kb.Banner color="blue">
              {"For security reasons, team names are unique and can't be changed, so choose carefully."}
            </Kb.Banner>
          ) : null}
          {isSubteam ? (
            <Kb.Banner color="blue">
              <Kb.BannerParagraph
                bannerColor="blue"
                content={[`You are creating a subteam of ${props.baseTeam}.`]}
              />
              <Kb.BannerParagraph
                bannerColor="blue"
                content={[{onClick: openSubteamInfo, text: 'Learn more'}]}
              />
            </Kb.Banner>
          ) : null}
          {props.errorText ? <Kb.Banner color="red">{props.errorText}</Kb.Banner> : null}
        </>
      }
      footer={{
        content: (
          <Kb.Button
            waiting={waiting}
            fullWidth={true}
            label="Create team"
            onClick={onSubmitCb}
            disabled={disabled}
          />
        ),
      }}
      header={modalHeader}
      onClose={props.onCancel}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="tiny">
        <Kb.LabeledInput
          placeholder="Name your team"
          value={name}
          onChangeText={setName}
          maxLength={16}
          disabled={waiting}
          onEnterKeyDown={disabled ? undefined : onSubmitCb}
          autoFocus={!Kb.Styles.isMobile /* keyboard can cover the "join subteam" box on mobile */}
        />
        {isSubteam && (
          <Kb.Text type="BodySmall" style={!name && Kb.Styles.globalStyles.opacity0}>
            This team will be named{' '}
            <Kb.Text type="BodySmallSemibold" style={styles.wordBreak}>
              {props.baseTeam}.{name}
            </Kb.Text>
          </Kb.Text>
        )}
        {isSubteam && (
          <Kb.Checkbox checked={joinSubteam} onCheck={setJoinSubteam} label="Join this subteam." />
        )}
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    padding: Kb.Styles.globalMargins.small,
  },
  wordBreak: Kb.Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
}))

type OwnProps = {subteamOf?: T.Teams.TeamID}

const Container = (ownProps: OwnProps) => {
  const subteamOf = ownProps.subteamOf ?? T.Teams.noTeamID
  const baseTeam = Teams.useTeamsState(s => Teams.getTeamMeta(s, subteamOf).teamname)
  const errorText = Teams.useTeamsState(s => upperFirst(s.errorInTeamCreation))
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }
  const resetErrorInTeamCreation = Teams.useTeamsState(s => s.dispatch.resetErrorInTeamCreation)
  const createNewTeam = Teams.useTeamsState(s => s.dispatch.createNewTeam)
  const onClearError = resetErrorInTeamCreation
  const onSubmit = (teamname: string, joinSubteam: boolean) => {
    createNewTeam(teamname, joinSubteam)
  }
  const props = {
    baseTeam,
    errorText,
    onCancel,
    onClearError,
    onSubmit,
  }
  return <CreateNewTeam {...props} />
}

export default Container
