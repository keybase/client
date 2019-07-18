import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as I from 'immutable'
import Header from './header'
import Banner from './banner'
import NoTeamsPlaceholder from './no-teams-placeholder'
import {memoize} from '../../util/memoize'

type DeletedTeam = {
  teamName: string
  deletedBy: string
}

export type Props = {
  loaded: boolean
  deletedTeams: ReadonlyArray<DeletedTeam>
  newTeams: ReadonlyArray<string>
  onBack?: () => void
  onCreateTeam: () => void
  onHideChatBanner: () => void
  onJoinTeam: () => void
  onManageChat: (arg0: string) => void
  onOpenFolder: (arg0: string) => void
  onReadMore: () => void
  onViewTeam: (arg0: string) => void
  sawChatBanner: boolean
  teamNameToCanManageChat: {[K in string]: boolean}
  teamNameToIsOpen: {[K in string]: boolean}
  teammembercounts: {[K in string]: number}
  teamnames: ReadonlyArray<string>
  teamresetusers: {[K in string]: I.Set<string> | null}
  teamToRequest: {[K in string]: number}
  title?: string
}

type RowProps = {
  firstItem: boolean
  name: string
  membercount: number
  isNew: boolean
  isOpen: boolean
  newRequests: number
  onOpenFolder: () => void
  onManageChat: (() => void) | null
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
            <Kb.Text type="BodySmall">
              {props.membercount + ' member' + (props.membercount !== 1 ? 's' : '')}
            </Kb.Text>
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
              <Kb.WithTooltip text="You need to join this team before you can chat.">
                <ChatIcon />
              </Kb.WithTooltip>
            )}
          </Kb.Box2>
        )
      }
    />
  )
})

type State = {
  sawChatBanner: boolean
}

class Teams extends React.PureComponent<Props, State> {
  state = {sawChatBanner: this.props.sawChatBanner}

  _teamsAndExtras = memoize((deletedTeams, teamnames) => [
    {key: '_banner', type: '_banner'},
    ...deletedTeams.map(t => ({key: 'deletedTeam' + t.teamName, team: t, type: 'deletedTeam'})),
    ...teamnames.map(t => ({key: t, team: t, type: 'team'})),
    ...(teamnames.length === 0 ? [{key: '_placeholder', type: '_placeholder'}] : []),
  ])

  _onHideChatBanner = () => {
    this.setState({sawChatBanner: true})
    this.props.onHideChatBanner()
  }
  _onOpenFolder = name => this.props.onOpenFolder(name)
  _onManageChat = name => this.props.onManageChat(name)
  _onViewTeam = name => this.props.onViewTeam(name)

  _renderItem = (index, item) => {
    switch (item.type) {
      case '_banner':
        return this.state.sawChatBanner ? null : (
          <Banner onReadMore={this.props.onReadMore} onHideChatBanner={this._onHideChatBanner} />
        )
      case '_placeholder':
        return <NoTeamsPlaceholder />
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
        const name = item.team
        const reset = this.props.teamresetusers[name]
        const resetUserCount = (reset && reset.size) || 0
        return (
          <TeamRow
            firstItem={index === 1}
            key={name}
            name={name}
            isNew={this.props.newTeams.includes(name)}
            isOpen={this.props.teamNameToIsOpen[name]}
            newRequests={this.props.teamToRequest[name] || 0}
            membercount={this.props.teammembercounts[name]}
            onOpenFolder={() => this._onOpenFolder(name)}
            onManageChat={this.props.teamNameToCanManageChat[name] ? () => this._onManageChat(name) : null}
            onViewTeam={() => this._onViewTeam(name)}
            resetUserCount={resetUserCount}
          />
        )
      }
      default:
        return null
    }
  }

  componentDidUpdate(prevProps: Props) {
    // Don't need to worry about the true->false direction.
    if (!prevProps.sawChatBanner && this.props.sawChatBanner) {
      this.setState({sawChatBanner: true})
    }
  }

  render() {
    const renderHeader = Styles.isMobile
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
          items={this._teamsAndExtras(this.props.deletedTeams, this.props.teamnames)}
          renderItem={this._renderItem}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  avatarContainer: {position: 'relative'},
  badge: {
    position: 'absolute',
    right: -5,
    top: -5,
  },
  kerning: {letterSpacing: 0.2},
  maxWidth: {maxWidth: '100%'},
  openMeta: {alignSelf: 'center'},
})

export default Teams
