import * as React from 'react'
import * as Kb from '../../common-adapters'
import type * as Types from '../../constants/types/chat2'
import type * as RPCTypes from '../../constants/types/rpc-gen'
import * as Container from '../../util/container'
import * as Constants from '../../constants/chat2'
import * as TeamsGen from '../../actions/teams-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'
import SelectableSmallTeam from '../selectable-small-team-container'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import {inboxWidth} from '../inbox/row/sizes'
import {TeamAvatar} from '../avatars'
import Rover from './background'
import TeamInfo from '../../profile/user/teams/teaminfo'
import type {Section as _Section} from '../../common-adapters/section-list'
import {Bot} from '../conversation/info-panel/bot'

type NameResult = {
  conversationIDKey: Types.ConversationIDKey
  name: string
  type: 'big' | 'small'
}

type TextResult = {
  conversationIDKey: Types.ConversationIDKey
  type: 'big' | 'small'
  name: string
  numHits: number
  query: string
}
type SectionExtra<T> = {
  indexOffset: number
  isCollapsed: boolean
  onCollapse: () => void
  onSelect: (item: T, index: number) => void
  renderHeader: (section: Section<T>) => React.ReactNode
  status: Types.InboxSearchStatus
  title: string
}
type Section<T> = _Section<T, SectionExtra<T>>

export type Props = {
  botsResults: Array<RPCTypes.FeaturedBot>
  botsResultsSuggested: boolean
  botsStatus: Types.InboxSearchStatus
  header?: React.ReactElement | null
  indexPercent: number
  nameResults: Array<NameResult>
  nameResultsUnread: boolean
  nameStatus: Types.InboxSearchStatus
  onInstallBot: (username: string) => void
  onCancel: () => void
  onSelectConversation: (arg0: Types.ConversationIDKey, arg1: number, arg2: string) => void
  openTeamsResults: Array<Types.InboxSearchOpenTeamHit>
  openTeamsResultsSuggested: boolean
  openTeamsStatus: Types.InboxSearchStatus
  query: string
  selectedIndex: number
  textResults: Array<TextResult>
  textStatus: Types.InboxSearchStatus
}

type State = {
  botsAll: boolean
  botsCollapsed: boolean
  nameCollapsed: boolean
  textCollapsed: boolean
  openTeamsAll: boolean
  openTeamsCollapsed: boolean
}

const emptyUnreadPlaceholder = {conversationIDKey: '', name: '---EMPTYRESULT---', type: 'small' as const}

class InboxSearch extends React.Component<Props, State> {
  state = {
    botsAll: false,
    botsCollapsed: false,
    nameCollapsed: false,
    openTeamsAll: false,
    openTeamsCollapsed: false,
    textCollapsed: false,
  }

  private renderOpenTeams = (h: {
    item: Types.InboxSearchOpenTeamHit
    section: {indexOffset: number}
    index: number
  }) => {
    const {item, index, section} = h
    const realIndex = index + section.indexOffset
    return (
      <OpenTeamRow
        description={item.description}
        name={item.name}
        memberCount={item.memberCount}
        inTeam={item.inTeam}
        publicAdmins={item.publicAdmins}
        isSelected={!Styles.isMobile && this.props.selectedIndex === realIndex}
      />
    )
  }

  private renderBots = (h: {item: RPCTypes.FeaturedBot; section: {indexOffset: number}; index: number}) => {
    const {item, index} = h
    return <Bot {...item} onClick={this.props.onInstallBot} firstItem={index === 0} hideHover={true} />
  }

  private renderHit = (h: {
    item: TextResult | NameResult
    section: {
      indexOffset: number
      onSelect: (item: NameResult | TextResult, index: number) => void
    }
    index: number
  }) => {
    if (h.item === emptyUnreadPlaceholder) {
      return (
        <Kb.Text style={styles.emptyUnreadPlaceholder} type="BodySmall" center={true}>
          No unread messages or conversations
        </Kb.Text>
      )
    }

    const {item, section, index} = h
    const numHits = (item as TextResult)?.numHits || undefined
    const realIndex = index + section.indexOffset
    return item.type === 'big' ? (
      <SelectableBigTeamChannel
        conversationIDKey={item.conversationIDKey}
        isSelected={!Styles.isMobile && this.props.selectedIndex === realIndex}
        name={item.name}
        numSearchHits={numHits}
        maxSearchHits={Constants.inboxSearchMaxTextMessages}
        onSelectConversation={() => section.onSelect(item, realIndex)}
      />
    ) : (
      <SelectableSmallTeam
        conversationIDKey={item.conversationIDKey}
        isSelected={!Styles.isMobile && this.props.selectedIndex === realIndex}
        name={item.name}
        numSearchHits={numHits}
        maxSearchHits={Constants.inboxSearchMaxTextMessages}
        onSelectConversation={() => section.onSelect(item, realIndex)}
      />
    )
  }
  private toggleCollapseName = () => {
    this.setState(s => ({nameCollapsed: !s.nameCollapsed}))
  }
  private toggleCollapseText = () => {
    this.setState(s => ({textCollapsed: !s.textCollapsed}))
  }
  private toggleCollapseOpenTeams = () => {
    this.setState(s => ({openTeamsCollapsed: !s.openTeamsCollapsed}))
  }
  private toggleOpenTeamsAll = () => {
    this.setState(s => ({openTeamsAll: !s.openTeamsAll}))
  }
  private toggleCollapseBots = () => {
    this.setState(s => ({botsCollapsed: !s.botsCollapsed}))
  }
  private toggleBotsAll = () => {
    this.setState(s => ({botsAll: !s.botsAll}))
  }
  private selectName = (item: NameResult, index: number) => {
    this.props.onSelectConversation(item.conversationIDKey, index, '')
    this.props.onCancel()
  }
  private selectText = (item: TextResult, index: number) => {
    this.props.onSelectConversation(item.conversationIDKey, index, item.query)
  }
  private selectBot = (item: RPCTypes.FeaturedBot) => {
    this.props.onInstallBot(item.botUsername)
  }
  private renderNameHeader = (section: Section<NameResult>) => {
    return (
      <Kb.SectionDivider
        collapsed={section.isCollapsed}
        label={section.title}
        onToggleCollapsed={section.onCollapse}
        showSpinner={section.status === 'inprogress'}
      />
    )
  }

  private getOpenTeamsResults = () => {
    return this.state.openTeamsAll ? this.props.openTeamsResults : this.props.openTeamsResults.slice(0, 3)
  }
  private renderTeamHeader = (section: any) => {
    const showMore = this.props.openTeamsResults.length > 3 && !this.state.openTeamsCollapsed
    const label = (
      <Kb.Box2 direction="horizontal" gap="xtiny">
        <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
        {showMore && (
          <Kb.Text
            onClick={(e: React.BaseSyntheticEvent) => {
              e.stopPropagation()
              this.toggleOpenTeamsAll()
            }}
            type="BodySmallSecondaryLink"
          >
            {!this.state.openTeamsAll ? '(more)' : '(less)'}
          </Kb.Text>
        )}
      </Kb.Box2>
    )
    return (
      <Kb.SectionDivider
        collapsed={section.isCollapsed}
        label={label}
        onToggleCollapsed={section.onCollapse}
        showSpinner={section.status === 'inprogress'}
      />
    )
  }

  private getBotsResults = () => {
    return this.state.botsAll ? this.props.botsResults : this.props.botsResults.slice(0, 3)
  }

  private renderBotsHeader = (section: Section<RPCTypes.FeaturedBot>) => {
    const showMore = this.props.botsResults.length > 3 && !this.state.botsCollapsed
    const label = (
      <Kb.Box2 direction="horizontal" gap="xtiny">
        <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
        {showMore && (
          <Kb.Text
            onClick={(e: React.BaseSyntheticEvent) => {
              e.stopPropagation()
              this.toggleBotsAll()
            }}
            type="BodySmallSecondaryLink"
          >
            {!this.state.botsAll ? '(more)' : '(less)'}
          </Kb.Text>
        )}
      </Kb.Box2>
    )
    return (
      <Kb.SectionDivider
        collapsed={section.isCollapsed}
        label={label}
        onToggleCollapsed={section.onCollapse}
        showSpinner={section.status === 'inprogress'}
      />
    )
  }

  private renderTextHeader = (section: Section<TextResult>) => {
    const ratio = this.props.indexPercent / 100.0
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.textHeader}>
        <Kb.SectionDivider
          collapsed={section.isCollapsed}
          label={section.title}
          onToggleCollapsed={section.onCollapse}
          showSpinner={section.status === 'inprogress'}
        />
        {this.props.textStatus === 'error' ? (
          <Kb.Box2 direction="horizontal" style={styles.percentContainer} fullWidth={true}>
            <Kb.Text type="BodyTiny" style={styles.errorText} center={true}>
              Search failed, please try again, or contact Keybase describing the problem.
            </Kb.Text>
          </Kb.Box2>
        ) : this.props.indexPercent > 0 && this.props.indexPercent < 100 ? (
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.percentContainer} fullWidth={true}>
            <Kb.Text type="BodyTiny">Indexing...</Kb.Text>
            {Styles.isMobile ? (
              <Kb.ProgressBar style={styles.progressBar} ratio={ratio} />
            ) : (
              <Kb.WithTooltip
                containerStyle={styles.progressBar}
                position="bottom center"
                tooltip={`${this.props.indexPercent}% complete`}
              >
                <Kb.ProgressBar style={styles.progressBar} ratio={ratio} />
              </Kb.WithTooltip>
            )}
          </Kb.Box2>
        ) : null}
      </Kb.Box2>
    )
  }
  private renderSectionHeader = ({
    section,
  }: {
    section:
      | Section<NameResult>
      | Section<Types.InboxSearchOpenTeamHit>
      | Section<RPCTypes.FeaturedBot>
      | Section<TextResult>
  }): React.ReactNode => {
    // @ts-ignore
    return section.renderHeader(section)
  }
  private keyExtractor = (
    _: RPCTypes.FeaturedBot | Types.InboxSearchOpenTeamHit | NameResult | TextResult,
    index: number
  ) => index

  render() {
    const nameResults: Array<NameResult> = this.state.nameCollapsed ? [] : this.props.nameResults
    const textResults = this.state.textCollapsed ? [] : this.props.textResults
    const openTeamsResults = this.state.openTeamsCollapsed ? [] : this.getOpenTeamsResults()
    const botsResults = this.state.botsCollapsed ? [] : this.getBotsResults()

    const indexOffset = botsResults.length + openTeamsResults.length + nameResults.length

    if (this.props.nameResultsUnread && !this.state.nameCollapsed && nameResults.length === 0) {
      nameResults.push(emptyUnreadPlaceholder)
    }

    const nameSection: Section<NameResult> = {
      data: nameResults,
      indexOffset: 0,
      isCollapsed: this.state.nameCollapsed,
      onCollapse: this.toggleCollapseName,
      onSelect: this.selectName,
      renderHeader: this.renderNameHeader,
      renderItem: this.renderHit,
      status: this.props.nameStatus,
      title: this.props.nameResultsUnread ? 'Unread' : 'Chats',
    }
    const openTeamsSection: Section<Types.InboxSearchOpenTeamHit> = {
      data: openTeamsResults,
      indexOffset: nameResults.length,
      isCollapsed: this.state.openTeamsCollapsed,
      onCollapse: this.toggleCollapseOpenTeams,
      // @ts-ignore TODO: pretty sure this line is just wrong:
      onSelect: this.selectText,
      renderHeader: this.renderTeamHeader,
      renderItem: this.renderOpenTeams,
      status: this.props.openTeamsStatus,
      title: this.props.openTeamsResultsSuggested ? 'Suggested teams' : 'Open teams',
    }
    const botsSection: Section<RPCTypes.FeaturedBot> = {
      data: botsResults,
      indexOffset: openTeamsResults.length + nameResults.length,
      isCollapsed: this.state.botsCollapsed,
      onCollapse: this.toggleCollapseBots,
      onSelect: this.selectBot,
      renderHeader: this.renderBotsHeader,
      renderItem: this.renderBots,
      status: this.props.botsStatus,
      title: this.props.botsResultsSuggested ? 'Suggested bots' : 'Featured bots',
    }
    const messagesSection: Section<TextResult> = {
      data: textResults,
      indexOffset,
      isCollapsed: this.state.textCollapsed,
      onCollapse: this.toggleCollapseText,
      onSelect: this.selectText,
      renderHeader: this.renderTextHeader,
      // @ts-ignore better typing
      renderItem: this.renderHit,
      status: this.props.textStatus,
      title: 'Messages',
    }
    const sections = [
      nameSection,
      openTeamsSection,
      botsSection,
      ...(!this.props.nameResultsUnread ? [messagesSection] : []),
    ]

    return (
      <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
        <Rover />
        <Kb.SectionList
          ListHeaderComponent={this.props.header}
          stickySectionHeadersEnabled={true}
          // @ts-ignore
          renderSectionHeader={this.renderSectionHeader}
          keyExtractor={this.keyExtractor}
          keyboardShouldPersistTaps="handled"
          sections={sections}
        />
      </Kb.Box2>
    )
  }
}

export const rowHeight = Styles.isMobile ? 64 : 56
type OpenTeamProps = Types.InboxSearchOpenTeamHit & {
  isSelected: boolean
}
const OpenTeamRow = (p: OpenTeamProps) => {
  const [hovering, setHovering] = React.useState(false)
  const {name, description, memberCount, publicAdmins, inTeam, isSelected} = p
  const dispatch = Container.useDispatch()
  const showingDueToSelect = React.useRef(false)
  const {showingPopup, setShowingPopup, popup, popupAnchor, toggleShowingPopup} = Kb.usePopup<Kb.Box2>(
    attachTo => (
      <TeamInfo
        attachTo={attachTo}
        description={description ?? ''}
        inTeam={inTeam}
        isOpen={true}
        name={name}
        membersCount={memberCount}
        position="right center"
        onChat={undefined}
        onHidden={toggleShowingPopup}
        onJoinTeam={() => dispatch(TeamsGen.createJoinTeam({teamname: name}))}
        onViewTeam={() => {
          dispatch(RouteTreeGen.createClearModals())
          dispatch(TeamsGen.createShowTeamByName({teamname: name}))
        }}
        publicAdmins={publicAdmins ?? []}
        visible={showingPopup}
      />
    )
  )

  React.useEffect(() => {
    if (!showingPopup && isSelected && !showingDueToSelect.current) {
      showingDueToSelect.current = true
      setShowingPopup(true)
    } else if (showingPopup && !isSelected && showingDueToSelect.current) {
      showingDueToSelect.current = false
      setShowingPopup(false)
    }
  }, [showingDueToSelect, setShowingPopup, showingPopup, isSelected])

  return (
    <Kb.ClickableBox onClick={toggleShowingPopup} style={{width: '100%'}}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        ref={popupAnchor}
        centerChildren={true}
        className="hover_background_color_blueGreyDark"
        style={Styles.collapseStyles([
          styles.openTeamContainer,
          {
            backgroundColor: isSelected ? Styles.globalColors.blue : Styles.globalColors.white,
            height: rowHeight,
          },
        ])}
        onMouseLeave={() => setHovering(false)}
        onMouseOver={() => setHovering(true)}
      >
        <TeamAvatar teamname={name} isMuted={false} isSelected={isSelected} isHovered={hovering} />
        <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}}>
          <Kb.Text
            type="BodySemibold"
            style={Styles.collapseStyles([
              {color: isSelected ? Styles.globalColors.white : Styles.globalColors.black},
            ])}
            title={name}
            lineClamp={Styles.isMobile ? 1 : undefined}
            ellipsizeMode="tail"
          >
            {name}
          </Kb.Text>
          <Kb.Text
            type="BodySmall"
            style={Styles.collapseStyles([
              {color: isSelected ? Styles.globalColors.white : Styles.globalColors.black_50},
            ])}
            title={`#${description}`}
            lineClamp={1}
            ellipsizeMode="tail"
          >
            {description}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      {popup}
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.flexBoxColumn,
          backgroundColor: Styles.globalColors.blueGrey,
          borderRightColor: Styles.globalColors.black_10,
          borderRightWidth: 1,
          borderStyle: 'solid',
          contain: 'strict',
          height: '100%',
          maxWidth: inboxWidth,
          minWidth: inboxWidth,
          position: 'relative',
        },
        isMobile: {
          height: '100%',
          width: '100%',
        },
      }),
      emptyUnreadPlaceholder: Styles.platformStyles({
        common: {...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny)},
        isTablet: {backgroundColor: Styles.globalColors.blueGrey},
      }),
      errorText: {
        color: Styles.globalColors.redDark,
      },
      openTeamContainer: Styles.platformStyles({
        isElectron: {
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
      percentContainer: Styles.platformStyles({
        common: {
          padding: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
      progressBar: {
        alignSelf: 'center',
        flex: 1,
        width: '100%',
      },
      textHeader: {
        backgroundColor: Styles.globalColors.blueLighter3,
      },
    } as const)
)

export default InboxSearch
