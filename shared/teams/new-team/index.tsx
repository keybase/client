import * as C from '@/constants'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {openURL as openUrl} from '@/util/misc'
import upperFirst from 'lodash/upperFirst'

const openSubteamInfo = () => openUrl('https://book.keybase.io/docs/teams/design')

type Props = {
  baseTeam?: string // if set we're creating a subteam of this teamname
  onCancel: () => void
  onSubmit: (fullName: string, joinSubteam: boolean) => void
}

// used in chat too
export const CreateNewTeam = (props: Props) => {
  const [name, setName] = React.useState('')
  const [joinSubteam, setJoinSubteam] = React.useState(true)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyTeamsCreation)
  const errorText = upperFirst(C.Waiting.useAnyErrors(C.waitingKeyTeamsCreation)?.message ?? '')
  const dispatchClearWaiting = C.Waiting.useDispatchClearWaiting()

  const {baseTeam, onSubmit} = props
  const isSubteam = !!baseTeam

  const onSubmitCb = () => {
    dispatchClearWaiting(C.waitingKeyTeamsCreation)
    return isSubteam ? onSubmit(baseTeam + '.' + name, joinSubteam) : onSubmit(name, false)
  }
  const disabled = name.length < 2

  React.useEffect(() => () => dispatchClearWaiting(C.waitingKeyTeamsCreation), [dispatchClearWaiting])

  return (
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
      {errorText ? <Kb.Banner color="red">{errorText}</Kb.Banner> : null}
      <Kb.ScrollView alwaysBounceVertical={false} style={Kb.Styles.globalStyles.flexOne}>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="tiny">
          <Kb.Input3
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
      </Kb.ScrollView>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>
          <Kb.Button
            waiting={waiting}
            fullWidth={true}
            label="Create team"
            onClick={onSubmitCb}
            disabled={disabled}
          />
      </Kb.Box2>
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    padding: Kb.Styles.globalMargins.small,
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
  const navigateUp = C.Router2.navigateUp
  const onCancel = () => {
    navigateUp()
  }
  const createNewTeam = Teams.useTeamsState(s => s.dispatch.createNewTeam)
  const onSubmit = (teamname: string, joinSubteam: boolean) => {
    createNewTeam(teamname, joinSubteam)
  }
  const props = {
    baseTeam,
    onCancel,
    onSubmit,
  }
  return <CreateNewTeam {...props} />
}

export default Container
