import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import Banner from './banner'
import TeamsFooter from './footer'
import TeamRowNew from './team-row'

type DeletedTeam = {
  teamName: string
  deletedBy: string
}

export type OwnProps = {
  loaded: boolean
  deletedTeams: ReadonlyArray<DeletedTeam>
  newTeams: ReadonlySet<T.Teams.TeamID>
  onHideChatBanner: () => void
  onManageChat: (teamID: T.Teams.TeamID) => void
  onOpenFolder: (teamID: T.Teams.TeamID) => void
  onReadMore: () => void
  onViewTeam: (teamID: T.Teams.TeamID) => void
  teamresetusers: ReadonlyMap<T.Teams.TeamID, ReadonlySet<string>>
  newTeamRequests: ReadonlyMap<T.Teams.TeamID, ReadonlySet<string>>
  teams: ReadonlyArray<T.Teams.TeamMeta>
}

type HeaderProps = {
  onCreateTeam: () => void
  onJoinTeam: () => void
}
export type Props = OwnProps & HeaderProps

const TeamBigButtons = (props: HeaderProps & {empty: boolean}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.teamButtons} gap="tiny">
    <Kb.ClickableBox
      style={styles.bigButton}
      onClick={props.onCreateTeam}
      className="background_color_white hover_background_color_blueLighter2"
    >
      <Kb.Box2 direction="vertical" gap="tiny" alignItems="center">
        <Kb.Text type="BodyBig">Create a team</Kb.Text>
        <Kb.Box style={styles.relative}>
          <Kb.Avatar isTeam={true} size={96} />
          <Kb.Icon type="iconfont-add-solid" sizeType="Default" style={styles.teamPlus} />
        </Kb.Box>
      </Kb.Box2>
    </Kb.ClickableBox>
    <Kb.ClickableBox
      style={styles.bigButton}
      onClick={props.onJoinTeam}
      className="background_color_white hover_background_color_blueLighter2"
    >
      <Kb.Box2 direction="vertical" gap="tiny" alignItems="center">
        <Kb.Text type="BodyBig">Join a team</Kb.Text>
        <Kb.Icon type="icon-illustration-teams-96" />
      </Kb.Box2>
    </Kb.ClickableBox>
    {props.empty && !Kb.Styles.isMobile && (
      <Kb.Text type="BodySmall" style={styles.emptyNote}>
        Keybase team chats are encrypted – unlike Slack – and work for any size group, from casual friends to
        large communities.
      </Kb.Text>
    )}
  </Kb.Box2>
)

const sortOrderToTitle = {
  activity: 'Activity',
  alphabetical: 'Alphabetical',
  role: 'Your role',
}
const SortHeader = () => {
  const onChangeSort = C.useTeamsState(s => s.dispatch.setTeamListSort)
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          items={[
            {icon: 'iconfont-team', onClick: () => onChangeSort('role'), title: sortOrderToTitle.role},
            {
              icon: 'iconfont-campfire',
              onClick: () => onChangeSort('activity'),
              title: sortOrderToTitle.activity,
            },
            {
              icon: 'iconfont-sort-alpha',
              onClick: () => onChangeSort('alphabetical'),
              title: sortOrderToTitle.alphabetical,
            },
          ]}
          closeOnSelect={true}
          onHidden={hidePopup}
          visible={true}
          position="bottom left"
        />
      )
    },
    [onChangeSort]
  )

  const {popup, showPopup, popupAnchor} = Kb.usePopup2(makePopup)
  const sortOrder = C.useTeamsState(s => s.teamListSort)
  return (
    <Kb.Box2 direction="horizontal" style={styles.sortHeader} alignItems="center" fullWidth={true}>
      <Kb.ClickableBox onClick={showPopup} ref={popupAnchor}>
        <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
          <Kb.Icon type="iconfont-arrow-full-down" />
          <Kb.Text type="BodySmallSemibold">{sortOrderToTitle[sortOrder]}</Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
      {popup}
    </Kb.Box2>
  )
}

type Row = {key: React.Key} & (
  | {type: '_banner' | '_sortHeader' | '_buttons' | '_footer'}
  | {team: DeletedTeam; type: 'deletedTeam'}
  | {team: T.Teams.TeamMeta; type: 'team'}
)

const Teams = React.memo(function Teams(p: Props) {
  const {deletedTeams, teams, onReadMore, onCreateTeam, onHideChatBanner, onJoinTeam} = p

  const items = React.useMemo(
    (): ReadonlyArray<Row> =>
      [
        {key: '_buttons', type: '_buttons'},
        {key: '_sortHeader', type: '_sortHeader'},
        ...deletedTeams.map(
          dt => ({key: 'deletedTeam' + dt.teamName, team: dt, type: 'deletedTeam'}) as const
        ),
        ...teams.map(team => ({key: team.id, team, type: 'team'}) as const),
        {key: '_footer', type: '_footer'},
      ] as const,
    [deletedTeams, teams]
  )

  const renderItem = React.useCallback(
    (index: number, item: Row) => {
      switch (item.type) {
        case '_banner':
          return <Banner onReadMore={onReadMore} onHideChatBanner={onHideChatBanner} />
        case '_footer':
          return <TeamsFooter empty={teams.length === 0} />
        case '_buttons':
          return (
            <TeamBigButtons onCreateTeam={onCreateTeam} onJoinTeam={onJoinTeam} empty={teams.length === 0} />
          )
        case '_sortHeader':
          return <SortHeader />
        case 'deletedTeam': {
          const {deletedBy, teamName} = item.team
          return (
            <Kb.Banner color="blue" key={'deletedTeamBannerFor' + teamName}>
              <Kb.BannerParagraph
                bannerColor="blue"
                content={`The ${teamName} team was deleted by ${deletedBy}.`}
              />
            </Kb.Banner>
          )
        }
        case 'team': {
          const team = item.team
          return <TeamRowNew firstItem={index === 2} showChat={!Kb.Styles.isMobile} teamID={team.id} />
        }
      }
    },
    [onCreateTeam, onHideChatBanner, onJoinTeam, onReadMore, teams]
  )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.List items={items} renderItem={renderItem} style={Kb.Styles.globalStyles.fullHeight} />
    </Kb.Box2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      avatarContainer: {position: 'relative'},
      badge: {
        position: 'absolute',
        right: -5,
        top: -5,
      },
      bigButton: Kb.Styles.platformStyles({
        common: {
          borderColor: Kb.Styles.globalColors.black_10,
          borderRadius: 8,
          borderStyle: 'solid',
          borderWidth: 1,
        },
        isElectron: {padding: Kb.Styles.globalMargins.small},
        isMobile: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.small, 0),
          backgroundColor: Kb.Styles.globalColors.white,
          width: 140,
        },
      }),
      container: {backgroundColor: Kb.Styles.globalColors.blueGrey},
      emptyNote: Kb.Styles.padding(60, 42, Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.medium),
      kerning: {letterSpacing: 0.2},
      maxWidth: {maxWidth: '100%'},
      openMeta: {alignSelf: 'center'},
      relative: {position: 'relative'},
      sortHeader: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.blueGrey},
        isElectron: {...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small)},
        isMobile: {...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.tiny)},
      }),
      teamButtons: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        justifyContent: 'flex-start',
      },
      teamPlus: {
        bottom: -2,
        color: Kb.Styles.globalColors.blue,
        position: 'absolute',
        right: -1,
      },
    }) as const
)

export default Teams
