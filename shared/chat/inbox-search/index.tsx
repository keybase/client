import * as C from '../../constants'
import * as Constants from '../../constants/chat2'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import Rover from './background'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import SelectableSmallTeam from '../selectable-small-team-container'
import TeamInfo from '../../profile/user/teams/teaminfo'
import type * as T from '../../constants/types'
import type {Section as _Section} from '../../common-adapters/section-list'
import {Bot} from '../conversation/info-panel/bot'
import {TeamAvatar} from '../avatars'
import {inboxWidth} from '../inbox/row/sizes'

type OwnProps = {header?: React.ReactElement | null}

const emptySearch = Constants.makeInboxSearchInfo()

export default React.memo(function InboxSearchContainer(ownProps: OwnProps) {
  const _inboxSearch = C.useChatState(s => s.inboxSearch ?? emptySearch)
  const toggleInboxSearch = C.useChatState(s => s.dispatch.toggleInboxSearch)
  const inboxSearchSelect = C.useChatState(s => s.dispatch.inboxSearchSelect)
  const onCancel = () => {
    toggleInboxSearch(false)
  }
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onInstallBot = (username: string) => {
    navigateAppend({props: {botUsername: username}, selected: 'chatInstallBotPick'})
  }
  const onSelectConversation = (
    conversationIDKey: T.Chat.ConversationIDKey,
    selectedIndex: number,
    query: string
  ) => {
    inboxSearchSelect(conversationIDKey, query.length > 0 ? query : undefined, selectedIndex)
  }
  const {header} = ownProps
  const {indexPercent, nameResults: _nameResults, nameResultsUnread, nameStatus, textStatus} = _inboxSearch
  const {botsResults, botsResultsSuggested, botsStatus} = _inboxSearch
  const {openTeamsResults, openTeamsResultsSuggested, openTeamsStatus} = _inboxSearch
  const {query, selectedIndex, textResults: _textResults} = _inboxSearch

  const [botsAll, setBotsAll] = React.useState(false)
  const [botsCollapsed, setBotsCollapsed] = React.useState(false)
  const [nameCollapsed, setNameCollapsed] = React.useState(false)
  const [openTeamsAll, setOpenTeamsAll] = React.useState(false)
  const [openTeamsCollapsed, setOpenTeamsCollapsed] = React.useState(false)
  const [textCollapsed, setTextCollapsed] = React.useState(false)

  const renderOpenTeams = (h: {
    item: T.Chat.InboxSearchOpenTeamHit
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
        isSelected={!Kb.Styles.isMobile && selectedIndex === realIndex}
      />
    )
  }

  const nameResults = _nameResults.map(r => ({
    conversationIDKey: r.conversationIDKey,
    name: r.name,
    type: r.teamType,
  }))

  const textResults = _textResults.map(r => ({
    conversationIDKey: r.conversationIDKey,
    name: r.name,
    numHits: r.numHits,
    query: r.query,
    type: r.teamType,
  }))

  const renderBots = (h: {item: T.RPCGen.FeaturedBot; section: {indexOffset: number}; index: number}) => {
    const {item, index} = h
    return (
      <C.ChatProvider id={C.noConversationIDKey} key={index} canBeNull={true}>
        <Bot {...item} onClick={onInstallBot} firstItem={index === 0} hideHover={true} />
      </C.ChatProvider>
    )
  }

  const toggleCollapseName = () => {
    setNameCollapsed(s => !s)
  }
  const toggleCollapseText = () => {
    setTextCollapsed(s => !s)
  }
  const toggleCollapseOpenTeams = () => {
    setOpenTeamsCollapsed(s => !s)
  }
  const toggleOpenTeamsAll = () => {
    setOpenTeamsAll(s => !s)
  }
  const toggleCollapseBots = () => {
    setBotsCollapsed(s => !s)
  }
  const toggleBotsAll = () => {
    setBotsAll(s => !s)
  }

  const selectText = (item: TextResult, index: number) => {
    onSelectConversation(item.conversationIDKey, index, item.query)
  }

  const selectBot = (item: T.RPCGen.FeaturedBot) => {
    onInstallBot(item.botUsername)
  }

  const renderNameHeader = (section: Section<NameResult>) => {
    return (
      <Kb.SectionDivider
        collapsed={section.isCollapsed}
        label={section.title}
        onToggleCollapsed={section.onCollapse}
        showSpinner={section.status === 'inprogress'}
      />
    )
  }

  const getOpenTeamsResults = () => {
    return openTeamsAll ? openTeamsResults : openTeamsResults.slice(0, 3)
  }

  const renderTeamHeader = (section: any) => {
    const showMore = openTeamsResults.length > 3 && !openTeamsCollapsed
    const label = (
      <Kb.Box2 direction="horizontal" gap="xtiny">
        <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
        {showMore && (
          <Kb.Text
            onClick={(e: React.BaseSyntheticEvent) => {
              e.stopPropagation()
              toggleOpenTeamsAll()
            }}
            type="BodySmallSecondaryLink"
          >
            {!openTeamsAll ? '(more)' : '(less)'}
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

  const getBotsResults = () => {
    return botsAll ? botsResults : botsResults.slice(0, 3)
  }

  const renderBotsHeader = (section: Section<T.RPCGen.FeaturedBot>) => {
    const showMore = botsResults.length > 3 && !botsCollapsed
    const label = (
      <Kb.Box2 direction="horizontal" gap="xtiny">
        <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
        {showMore && (
          <Kb.Text
            onClick={(e: React.BaseSyntheticEvent) => {
              e.stopPropagation()
              toggleBotsAll()
            }}
            type="BodySmallSecondaryLink"
          >
            {!botsAll ? '(more)' : '(less)'}
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

  const renderTextHeader = (section: Section<TextResult>) => {
    const ratio = indexPercent / 100.0
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.textHeader}>
        <Kb.SectionDivider
          collapsed={section.isCollapsed}
          label={section.title}
          onToggleCollapsed={section.onCollapse}
          showSpinner={section.status === 'inprogress'}
        />
        {textStatus === 'error' ? (
          <Kb.Box2 direction="horizontal" style={styles.percentContainer} fullWidth={true}>
            <Kb.Text type="BodyTiny" style={styles.errorText} center={true}>
              Search failed, please try again, or contact Keybase describing the problem.
            </Kb.Text>
          </Kb.Box2>
        ) : indexPercent > 0 && indexPercent < 100 ? (
          <Kb.Box2 direction="horizontal" gap="xtiny" style={styles.percentContainer} fullWidth={true}>
            <Kb.Text type="BodyTiny">Indexing...</Kb.Text>
            {Kb.Styles.isMobile ? (
              <Kb.ProgressBar style={styles.progressBar} ratio={ratio} />
            ) : (
              <Kb.WithTooltip
                containerStyle={styles.progressBar}
                position="bottom center"
                tooltip={`${indexPercent}% complete`}
              >
                <Kb.ProgressBar style={styles.progressBar} ratio={ratio} />
              </Kb.WithTooltip>
            )}
          </Kb.Box2>
        ) : null}
      </Kb.Box2>
    )
  }

  const renderSectionHeader = ({
    section,
  }: {
    section:
      | Section<NameResult>
      | Section<T.Chat.InboxSearchOpenTeamHit>
      | Section<T.RPCGen.FeaturedBot>
      | Section<TextResult>
  }): React.ReactNode => {
    // @ts-ignore
    return section.renderHeader(section)
  }
  const keyExtractor = (
    _: T.RPCGen.FeaturedBot | T.Chat.InboxSearchOpenTeamHit | NameResult | TextResult,
    index: number
  ) => index

  const renderHit = (h: {
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
      <C.ChatProvider id={item.conversationIDKey}>
        <SelectableBigTeamChannel
          isSelected={!Kb.Styles.isMobile && selectedIndex === realIndex}
          name={item.name}
          numSearchHits={numHits}
          maxSearchHits={Constants.inboxSearchMaxTextMessages}
          onSelectConversation={() => section.onSelect(item, realIndex)}
        />
      </C.ChatProvider>
    ) : (
      <C.ChatProvider id={item.conversationIDKey}>
        <SelectableSmallTeam
          isSelected={!Kb.Styles.isMobile && selectedIndex === realIndex}
          name={item.name}
          numSearchHits={numHits}
          maxSearchHits={Constants.inboxSearchMaxTextMessages}
          onSelectConversation={() => section.onSelect(item, realIndex)}
        />
      </C.ChatProvider>
    )
  }

  const selectName = (item: NameResult, index: number) => {
    onSelectConversation(item.conversationIDKey, index, '')
    onCancel()
  }

  const props = {
    botsAll,
    botsCollapsed,
    botsResults,
    botsResultsSuggested,
    botsStatus,
    getBotsResults,
    getOpenTeamsResults,
    header,
    indexPercent,
    keyExtractor,
    nameCollapsed,
    nameResults,
    nameResultsUnread,
    nameStatus,
    onCancel,
    onInstallBot,
    onSelectConversation,
    openTeamsAll,
    openTeamsCollapsed,
    openTeamsResults,
    openTeamsResultsSuggested,
    openTeamsStatus,
    query,
    renderBots,
    renderBotsHeader,
    renderHit,
    renderNameHeader,
    renderOpenTeams,
    renderSectionHeader,
    renderTeamHeader,
    renderTextHeader,
    selectBot,
    selectName,
    selectText,
    selectedIndex,
    setBotsAll,
    setBotsCollapsed,
    setNameCollapsed,
    setOpenTeamsAll,
    setOpenTeamsCollapsed,
    setTextCollapsed,
    textCollapsed,
    textResults,
    textStatus,
    toggleBotsAll,
    toggleCollapseBots,
    toggleCollapseName,
    toggleCollapseOpenTeams,
    toggleCollapseText,
    toggleOpenTeamsAll,
  }
  return <InboxSearch {...props} />
})

type NameResult = {
  conversationIDKey: T.Chat.ConversationIDKey
  name: string
  type: 'big' | 'small'
}

type TextResult = {
  conversationIDKey: T.Chat.ConversationIDKey
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
  status: T.Chat.InboxSearchStatus
  title: string
}
type Section<T> = _Section<T, SectionExtra<T>>

export type Props = {
  keyExtractor: (
    _: T.RPCGen.FeaturedBot | T.Chat.InboxSearchOpenTeamHit | NameResult | TextResult,
    index: number
  ) => number
  renderSectionHeader: ({
    section,
  }: {
    section:
      | Section<NameResult>
      | Section<T.Chat.InboxSearchOpenTeamHit>
      | Section<T.RPCGen.FeaturedBot>
      | Section<TextResult>
  }) => React.ReactNode
  renderTextHeader: (section: Section<TextResult>) => React.JSX.Element
  renderBotsHeader: (section: Section<T.RPCGen.FeaturedBot>) => React.JSX.Element
  getBotsResults: () => T.RPCChat.Keybase1.FeaturedBot[]
  renderTeamHeader: (section: any) => React.JSX.Element
  getOpenTeamsResults: () => T.Chat.InboxSearchOpenTeamHit[]
  renderNameHeader: (section: Section<NameResult>) => React.JSX.Element
  selectBot: (item: T.RPCGen.FeaturedBot) => void
  selectText: (item: TextResult, index: number) => void
  selectName: (item: NameResult, index: number) => void
  renderHit: (h: {
    item: TextResult | NameResult
    section: {
      indexOffset: number
      onSelect: (item: NameResult | TextResult, index: number) => void
    }
    index: number
  }) => React.JSX.Element
  toggleCollapseName: () => void
  toggleCollapseText: () => void
  toggleCollapseOpenTeams: () => void
  toggleOpenTeamsAll: () => void
  toggleCollapseBots: () => void
  toggleBotsAll: () => void
  renderBots: (h: {
    item: T.RPCGen.FeaturedBot
    section: {
      indexOffset: number
    }
    index: number
  }) => React.JSX.Element
  renderOpenTeams: (h: {
    item: T.Chat.InboxSearchOpenTeamHit
    section: {
      indexOffset: number
    }
    index: number
  }) => React.JSX.Element
  botsAll: boolean
  botsCollapsed: boolean
  nameCollapsed: boolean
  openTeamsAll: boolean
  openTeamsCollapsed: boolean
  textCollapsed: boolean

  setBotsAll: React.Dispatch<React.SetStateAction<boolean>>
  setBotsCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  setNameCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  setOpenTeamsAll: React.Dispatch<React.SetStateAction<boolean>>
  setOpenTeamsCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  setTextCollapsed: React.Dispatch<React.SetStateAction<boolean>>

  botsResults: Array<T.RPCGen.FeaturedBot>
  botsResultsSuggested: boolean
  botsStatus: T.Chat.InboxSearchStatus
  header?: React.ReactElement | null
  indexPercent: number
  nameResults: Array<NameResult>
  nameResultsUnread: boolean
  nameStatus: T.Chat.InboxSearchStatus
  onInstallBot: (username: string) => void
  onCancel: () => void
  onSelectConversation: (arg0: T.Chat.ConversationIDKey, arg1: number, arg2: string) => void
  openTeamsResults: Array<T.Chat.InboxSearchOpenTeamHit>
  openTeamsResultsSuggested: boolean
  openTeamsStatus: T.Chat.InboxSearchStatus
  query: string
  selectedIndex: number
  textResults: Array<TextResult>
  textStatus: T.Chat.InboxSearchStatus
}

const emptyUnreadPlaceholder = {conversationIDKey: '', name: '---EMPTYRESULT---', type: 'small' as const}

class InboxSearch extends React.Component<Props> {
  render() {
    const nameResults: Array<NameResult> = this.props.nameCollapsed ? [] : this.props.nameResults
    const textResults = this.props.textCollapsed ? [] : this.props.textResults
    const openTeamsResults = this.props.openTeamsCollapsed ? [] : this.props.getOpenTeamsResults()
    const botsResults = this.props.botsCollapsed ? [] : this.props.getBotsResults()

    const indexOffset = botsResults.length + openTeamsResults.length + nameResults.length

    if (this.props.nameResultsUnread && !this.props.nameCollapsed && nameResults.length === 0) {
      nameResults.push(emptyUnreadPlaceholder)
    }

    const nameSection: Section<NameResult> = {
      data: nameResults,
      indexOffset: 0,
      isCollapsed: this.props.nameCollapsed,
      onCollapse: this.props.toggleCollapseName,
      onSelect: this.props.selectName,
      renderHeader: this.props.renderNameHeader,
      renderItem: this.props.renderHit,
      status: this.props.nameStatus,
      title: this.props.nameResultsUnread ? 'Unread' : 'Chats',
    }
    const openTeamsSection: Section<T.Chat.InboxSearchOpenTeamHit> = {
      data: openTeamsResults,
      indexOffset: nameResults.length,
      isCollapsed: this.props.openTeamsCollapsed,
      onCollapse: this.props.toggleCollapseOpenTeams,
      // @ts-ignore TODO: pretty sure this line is just wrong:
      onSelect: this.props.selectText,
      renderHeader: this.props.renderTeamHeader,
      renderItem: this.props.renderOpenTeams,
      status: this.props.openTeamsStatus,
      title: this.props.openTeamsResultsSuggested ? 'Suggested teams' : 'Open teams',
    }
    const botsSection: Section<T.RPCGen.FeaturedBot> = {
      data: botsResults,
      indexOffset: openTeamsResults.length + nameResults.length,
      isCollapsed: this.props.botsCollapsed,
      onCollapse: this.props.toggleCollapseBots,
      onSelect: this.props.selectBot,
      renderHeader: this.props.renderBotsHeader,
      renderItem: this.props.renderBots,
      status: this.props.botsStatus,
      title: this.props.botsResultsSuggested ? 'Suggested bots' : 'Featured bots',
    }
    const messagesSection: Section<TextResult> = {
      data: textResults,
      indexOffset,
      isCollapsed: this.props.textCollapsed,
      onCollapse: this.props.toggleCollapseText,
      onSelect: this.props.selectText,
      renderHeader: this.props.renderTextHeader,
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
          renderSectionHeader={this.props.renderSectionHeader}
          keyExtractor={this.props.keyExtractor}
          keyboardShouldPersistTaps="handled"
          sections={sections}
        />
      </Kb.Box2>
    )
  }
}

export const rowHeight = Kb.Styles.isMobile ? 64 : 56
type OpenTeamProps = T.Chat.InboxSearchOpenTeamHit & {isSelected: boolean}
const OpenTeamRow = (p: OpenTeamProps) => {
  const [hovering, setHovering] = React.useState(false)
  const {name, description, memberCount, publicAdmins, inTeam, isSelected} = p
  const showingDueToSelect = React.useRef(false)
  const joinTeam = C.useTeamsState(s => s.dispatch.joinTeam)
  const showTeamByName = C.useTeamsState(s => s.dispatch.showTeamByName)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
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
          onJoinTeam={() => joinTeam(name)}
          onViewTeam={() => {
            clearModals()
            showTeamByName(name)
          }}
          publicAdmins={publicAdmins ?? []}
          visible={true}
        />
      )
    },
    [showTeamByName, joinTeam, description, inTeam, memberCount, name, publicAdmins, clearModals]
  )
  const {showingPopup, setShowingPopup, popup, popupAnchor, toggleShowingPopup} = Kb.usePopup2(makePopup)

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
        ref={popupAnchor as any}
        centerChildren={true}
        className="hover_background_color_blueGreyDark"
        style={Kb.Styles.collapseStyles([
          styles.openTeamContainer,
          {
            backgroundColor: isSelected ? Kb.Styles.globalColors.blue : Kb.Styles.globalColors.white,
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
            style={Kb.Styles.collapseStyles([
              {color: isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black},
            ])}
            title={name}
            lineClamp={Kb.Styles.isMobile ? 1 : undefined}
            ellipsizeMode="tail"
          >
            {name}
          </Kb.Text>
          <Kb.Text
            type="BodySmall"
            style={Kb.Styles.collapseStyles([
              {color: isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black_50},
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          borderRightColor: Kb.Styles.globalColors.black_10,
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
      emptyUnreadPlaceholder: Kb.Styles.platformStyles({
        common: {...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny)},
        isTablet: {backgroundColor: Kb.Styles.globalColors.blueGrey},
      }),
      errorText: {color: Kb.Styles.globalColors.redDark},
      openTeamContainer: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      percentContainer: Kb.Styles.platformStyles({
        common: {padding: Kb.Styles.globalMargins.tiny},
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      progressBar: {
        alignSelf: 'center',
        flex: 1,
        width: '100%',
      },
      textHeader: {backgroundColor: Kb.Styles.globalColors.blueLighter3},
    }) as const
)
