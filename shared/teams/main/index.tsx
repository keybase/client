import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/teams'
import Header from './header'
import Banner from './banner'
import NoTeamsPlaceholder from './no-teams-placeholder'
import TeamRowNew from './team-row'
import {memoize} from '../../util/memoize'
import {pluralize} from '../../util/string'
import flags from '../../util/feature-flags'

type DeletedTeam = {
  teamName: string
  deletedBy: string
}

export type OwnProps = {
  loaded: boolean
  deletedTeams: ReadonlyArray<DeletedTeam>
  newTeams: Set<Types.TeamID>
  onHideChatBanner: () => void
  onManageChat: (teamID: Types.TeamID) => void
  onOpenFolder: (teamID: Types.TeamID) => void
  onReadMore: () => void
  onViewTeam: (teamID: Types.TeamID) => void
  sawChatBanner: boolean
  teamresetusers: Map<Types.TeamID, Set<string>>
  newTeamRequests: Map<Types.TeamID, Set<string>>
  teams: Array<Types.TeamMeta>
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

export const TeamRow = React.memo<RowProps>((props: RowProps) => {
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

const TeamBigButtons = (props: HeaderProps) => (
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
          <Kb.Icon type="iconfont-add" sizeType="Default" style={styles.teamPlus} />
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
  </Kb.Box2>
)

const getMembersText = (count: number) => (count === -1 ? '' : `${count} ${pluralize('member', count)}`)

type Row = {key: React.Key} & (
  | {type: '_banner' | '_placeholder' | '_buttons'}
  | {team: DeletedTeam; type: 'deletedTeam'}
  | {team: Types.TeamMeta; type: 'team'}
)

type State = {
  sawChatBanner: boolean
}

class Teams extends React.PureComponent<Props, State> {
  state = {sawChatBanner: this.props.sawChatBanner}

  private teamsAndExtras = memoize(
    (deletedTeams: Props['deletedTeams'], teams: Props['teams']): Array<Row> => [
      ...(flags.teamsRedesign ? [{key: '_buttons', type: '_buttons' as const}] : []),
      ...(this.state.sawChatBanner || flags.teamsRedesign
        ? []
        : [{key: '_banner', type: '_banner' as const}]),
      ...deletedTeams.map(dt => ({key: 'deletedTeam' + dt.teamName, team: dt, type: 'deletedTeam' as const})),
      ...teams.map(team => ({key: team.id, team, type: 'team' as const})),
      ...(teams.length === 0 ? [{key: '_placeholder', type: '_placeholder' as const}] : []),
    ]
  )

  private onHideChatBanner = () => {
    this.setState({sawChatBanner: true})
    this.props.onHideChatBanner()
  }
  private onOpenFolder = id => this.props.onOpenFolder(id)
  private onManageChat = id => this.props.onManageChat(id)
  private onViewTeam = (teamID: Types.TeamID) => this.props.onViewTeam(teamID)

  private renderItem = (index: number, item: Row) => {
    switch (item.type) {
      case '_banner':
        return <Banner onReadMore={this.props.onReadMore} onHideChatBanner={this.onHideChatBanner} />
      case '_placeholder':
        return <NoTeamsPlaceholder />
      case '_buttons':
        return <TeamBigButtons onCreateTeam={this.props.onCreateTeam} onJoinTeam={this.props.onJoinTeam} />
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
        const reset = this.props.teamresetusers.get(team.id)
        const resetUserCount = (reset && reset.size) || 0
        if (flags.teamsRedesign) {
          return <TeamRowNew firstItem={index === 1} showChat={!Styles.isMobile} teamID={team.id} />
        }
        return (
          <TeamRow
            firstItem={index === (this.state.sawChatBanner ? 0 : 1)}
            key={team.teamname}
            name={team.teamname}
            isNew={this.props.newTeams.has(team.id)}
            isOpen={team.isOpen}
            newRequests={this.props.newTeamRequests.get(team.id)?.size ?? 0}
            membercount={team.memberCount}
            onOpenFolder={() => this.onOpenFolder(team.teamname)}
            onManageChat={team.isMember ? () => this.onManageChat(team.id) : undefined}
            onViewTeam={() => this.onViewTeam(team.id)}
            resetUserCount={resetUserCount}
          />
        )
      }
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Don't need to worry about the true->false direction.
    if (!prevProps.sawChatBanner && this.props.sawChatBanner) {
      this.setState({sawChatBanner: true})
    }
  }

  render() {
    const renderHeader = Styles.isMobile && !flags.teamsRedesign
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
        {renderHeader && (
          <Header
            loaded={this.props.loaded}
            onCreateTeam={this.props.onCreateTeam}
            onJoinTeam={this.props.onJoinTeam}
          />
        )}
        <Kb.List
          items={this.teamsAndExtras(this.props.deletedTeams, this.props.teams)}
          renderItem={this.renderItem}
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
      kerning: {letterSpacing: 0.2},
      maxWidth: {maxWidth: '100%'},
      openMeta: {alignSelf: 'center'},
      relative: {position: 'relative'},
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
    } as const)
)

export default Teams
