import * as C from '@/constants'
import {useTeamsState} from '@/stores/teams'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import OpenMeta from './openmeta'
import {default as TeamInfo, type Props as TIProps} from './teaminfo'
import {useTrackerState} from '@/stores/tracker2'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {username: string}

const noTeams = new Array<T.Tracker.TeamShowcase>()

const Container = (ownProps: OwnProps) => {
  const d = useTrackerState(s => s.getDetails(ownProps.username))
  const _isYou = useCurrentUserState(s => s.username === ownProps.username)
  const teamsState = useTeamsState(
    C.useShallow(s => ({
      _roles: s.teamRoleMap.roles,
      _teamNameToID: s.teamNameToID,
      _youAreInTeams: s.teamnames.size > 0,
      joinTeam: s.dispatch.joinTeam,
      showTeamByName: s.dispatch.showTeamByName,
    }))
  )
  const {joinTeam, showTeamByName, _roles} = teamsState
  const {_teamNameToID, _youAreInTeams} = teamsState
  const teamShowcase = d.teamShowcase || noTeams
  const {clearModals, navigateAppend} = C.useRouterState(
    C.useShallow(s => ({
      clearModals: s.dispatch.clearModals,
      navigateAppend: s.dispatch.navigateAppend,
    }))
  )
  const _onEdit = () => {
    navigateAppend('profileShowcaseTeamOffer')
  }
  const onJoinTeam = joinTeam
  const onViewTeam = (teamname: string) => {
    clearModals()
    showTeamByName(teamname)
  }
  const onEdit = _isYou && _youAreInTeams ? _onEdit : undefined
  const teamMeta = teamShowcase.reduce<{
    [key: string]: {
      inTeam: boolean
      teamID: T.Teams.TeamID
    }
  }>((map, t) => {
    const teamID = _teamNameToID.get(t.name) || T.Teams.noTeamID
    map[t.name] = {
      inTeam: !!((_roles.get(teamID)?.role || 'none') !== 'none'),
      teamID,
    }
    return map
  }, {})

  return onEdit || teamShowcase.length > 0 ? (
    <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.showcases}>
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
        <Kb.Text type="BodySmallSemibold">Teams</Kb.Text>
        {!!onEdit && <Kb.Icon type="iconfont-edit" onClick={onEdit} />}
      </Kb.Box2>
      {!!onEdit && !teamShowcase.length && <ShowcaseTeamsOffer onEdit={onEdit} />}
      {teamShowcase.map(t => (
        <TeamShowcase
          key={t.name}
          {...t}
          onJoinTeam={onJoinTeam}
          onViewTeam={() => onViewTeam(t.name)}
          inTeam={teamMeta[t.name]?.inTeam ?? false}
        />
      ))}
    </Kb.Box2>
  ) : null
}

const TeamShowcase = (props: Omit<TIProps, 'visible' | 'onHidden'>) => {
  const {name, isOpen} = props
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return <TeamInfo {...props} attachTo={attachTo} onHidden={hidePopup} visible={true} />
    },
    [props]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return (
    <Kb.ClickableBox ref={popupAnchor} onClick={showPopup}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.showcase}>
        <>
          {popup}
          <Kb.Avatar size={32} teamname={props.name} isTeam={true} />
        </>
        <Kb.Text type="BodySemiboldLink" style={styles.link}>
          {name}
        </Kb.Text>
        <OpenMeta isOpen={isOpen} />
      </Kb.Box2>
    </Kb.ClickableBox>
  )
}

const ShowcaseTeamsOffer = (p: {onEdit: () => void}) => (
  <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
    <Kb.ClickableBox onClick={p.onEdit}>
      <Kb.Box2 direction="horizontal" gap="tiny">
        <Kb.Icon type="icon-team-placeholder-avatar-32" style={styles.placeholderTeam} />
        <Kb.Text style={styles.youFeatureTeam} type="BodyPrimaryLink">
          {"Feature the teams you're in"}
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      link: {color: Kb.Styles.globalColors.black},
      placeholderTeam: {borderRadius: Kb.Styles.borderRadius},
      showcase: {alignItems: 'center'},
      showcases: {
        alignItems: 'flex-start',
        flexShrink: 0,
        paddingBottom: Kb.Styles.globalMargins.small,
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      youFeatureTeam: {
        alignSelf: 'center',
        color: Kb.Styles.globalColors.black_50,
      },
    }) as const
)

export default Container
