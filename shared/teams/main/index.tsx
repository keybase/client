import * as C from '../../constants'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import type * as T from '../../constants/types'
import Banner from './banner'
import TeamsFooter from './footer'
import TeamRowNew from './team-row'
import {memoize} from '../../util/memoize'
import {pluralize} from '../../util/string'

type DeletedTeam = {
  teamName: string
  deletedBy: string
}

export type OwnProps = {
  loaded: boolean
  deletedTeams: ReadonlyArray<DeletedTeam>
  newTeams: Set<T.Teams.TeamID>
  onHideChatBanner: () => void
  onManageChat: (teamID: T.Teams.TeamID) => void
  onOpenFolder: (teamID: T.Teams.TeamID) => void
  onReadMore: () => void
  onViewTeam: (teamID: T.Teams.TeamID) => void
  teamresetusers: Map<T.Teams.TeamID, Set<string>>
  newTeamRequests: Map<T.Teams.TeamID, Set<string>>
  teams: Array<T.Teams.TeamMeta>
}

type HeaderProps = {
  onCreateTeam: () => void
  onJoinTeam: () => void
}
export type Props = OwnProps & HeaderProps

type RowProps = {
  firstItem: boolean
  name: string
  membercount: number
  isNew: boolean
  isOpen: boolean
  newRequests: number
  onOpenFolder: () => void
  onManageChat?: () => void
  resetUserCount: number
  onViewTeam: () => void
}

export const TeamRow = React.memo<RowProps>(function TeamRow(props: RowProps) {
  const badgeCount = props.newRequests + props.resetUserCount
  const ChatIcon = () => (
    <Kb.Icon
      style={{opacity: props.onManageChat ? 1 : 0.3}}
      onClick={props.onManageChat}
      type="iconfont-chat"
    />
  )
  return (
    <Kb.ListItem2
      type="Small"
      firstItem={props.firstItem}
      onClick={props.onViewTeam}
      icon={
        <Kb.Box2 direction="vertical" style={styles.avatarContainer}>
          <Kb.Avatar size={32} teamname={props.name} isTeam={true} />
          {!!badgeCount && <Kb.Badge badgeNumber={badgeCount} badgeStyle={styles.badge} />}
        </Kb.Box2>
      }
      body={
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.maxWidth}>
          <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start" style={styles.maxWidth}>
            <Kb.Text type="BodySemibold" lineClamp={1} style={styles.kerning}>
              {props.name}
            </Kb.Text>
            {props.isOpen && (
              <Kb.Meta title="open" backgroundColor={Styles.globalColors.green} style={styles.openMeta} />
            )}
          </Kb.Box2>
          <Kb.Box2 direction="horizontal" gap="tiny" alignSelf="flex-start">
            {props.isNew && <Kb.Meta title="new" backgroundColor={Styles.globalColors.orange} />}
            <Kb.Text type="BodySmall">{getMembersText(props.membercount)}</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      }
      action={
        Styles.isMobile ? null : (
          <Kb.Box2 direction="horizontal" gap="small" gapEnd={true} gapStart={true}>
            {props.onOpenFolder && <Kb.Icon type="iconfont-folder-private" onClick={props.onOpenFolder} />}
            {props.onManageChat ? (
              <ChatIcon />
            ) : (
              <Kb.WithTooltip tooltip="You need to join this team before you can chat.">
                <ChatIcon />
              </Kb.WithTooltip>
            )}
          </Kb.Box2>
        )
      }
    />
  )
})

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
    {props.empty && !Styles.isMobile && (
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
  const setTeamListFilterSort = C.useTeamsState(s => s.dispatch.setTeamListFilterSort)
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      const onChangeSort = (sortOrder: T.Teams.TeamListSort) => setTeamListFilterSort(sortOrder)
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
          onHidden={toggleShowingPopup}
          visible={true}
          position="bottom left"
        />
      )
    },
    [setTeamListFilterSort]
  )

  const {popup, toggleShowingPopup, popupAnchor} = Kb.usePopup2(makePopup)
  const sortOrder = C.useTeamsState(s => s.teamListSort)
  return (
    <Kb.Box2 direction="horizontal" style={styles.sortHeader} alignItems="center" fullWidth={true}>
      <Kb.ClickableBox onClick={toggleShowingPopup} ref={popupAnchor}>
        <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center">
          <Kb.Icon type="iconfont-arrow-full-down" />
          <Kb.Text type="BodySmallSemibold">{sortOrderToTitle[sortOrder]}</Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
      {popup}
    </Kb.Box2>
  )
}

const getMembersText = (count: number) => (count === -1 ? '' : `${count} ${pluralize('member', count)}`)

type Row = {key: React.Key} & (
  | {type: '_banner' | '_sortHeader' | '_buttons' | '_footer'}
  | {team: DeletedTeam; type: 'deletedTeam'}
  | {team: T.Teams.TeamMeta; type: 'team'}
)

class Teams extends React.PureComponent<Props> {
  private teamsAndExtras = memoize(
    (deletedTeams: Props['deletedTeams'], teams: Props['teams']): Array<Row> => [
      {key: '_buttons', type: '_buttons' as const},
      {key: '_sortHeader', type: '_sortHeader' as const},
      ...deletedTeams.map(dt => ({key: 'deletedTeam' + dt.teamName, team: dt, type: 'deletedTeam' as const})),
      ...teams.map(team => ({key: team.id, team, type: 'team' as const})),
      {key: '_footer', type: '_footer' as const},
    ]
  )

  private onHideChatBanner = () => {
    this.props.onHideChatBanner()
  }

  private renderItem = (index: number, item: Row) => {
    switch (item.type) {
      case '_banner':
        return <Banner onReadMore={this.props.onReadMore} onHideChatBanner={this.onHideChatBanner} />
      case '_footer':
        return <TeamsFooter empty={this.props.teams.length === 0} />
      case '_buttons':
        return (
          <TeamBigButtons
            onCreateTeam={this.props.onCreateTeam}
            onJoinTeam={this.props.onJoinTeam}
            empty={this.props.teams.length === 0}
          />
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
        return <TeamRowNew firstItem={index === 2} showChat={!Styles.isMobile} teamID={team.id} />
      }
    }
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        <Kb.List
          items={this.teamsAndExtras(this.props.deletedTeams, this.props.teams)}
          renderItem={this.renderItem}
          style={Styles.globalStyles.fullHeight}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      avatarContainer: {position: 'relative'},
      badge: {
        position: 'absolute',
        right: -5,
        top: -5,
      },
      bigButton: Styles.platformStyles({
        common: {
          borderColor: Styles.globalColors.black_10,
          borderRadius: 8,
          borderStyle: 'solid',
          borderWidth: 1,
        },
        isElectron: {padding: Styles.globalMargins.small},
        isMobile: {
          ...Styles.padding(Styles.globalMargins.small, 0),
          backgroundColor: Styles.globalColors.white,
          width: 140,
        },
      }),
      container: {backgroundColor: Styles.globalColors.blueGrey},
      emptyNote: Styles.padding(60, 42, Styles.globalMargins.medium, Styles.globalMargins.medium),
      kerning: {letterSpacing: 0.2},
      maxWidth: {maxWidth: '100%'},
      openMeta: {alignSelf: 'center'},
      relative: {position: 'relative'},
      sortHeader: Styles.platformStyles({
        common: {backgroundColor: Styles.globalColors.blueGrey},
        isElectron: {...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small)},
        isMobile: {...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.tiny)},
      }),
      teamButtons: {
        ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
        backgroundColor: Styles.globalColors.blueGrey,
        justifyContent: 'flex-start',
      },
      teamPlus: {
        bottom: -2,
        color: Styles.globalColors.blue,
        position: 'absolute',
        right: -1,
      },
    }) as const
)

export default Teams
