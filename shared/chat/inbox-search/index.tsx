import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Rover from './background'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import SelectableSmallTeam from '../selectable-small-team-container'
import TeamInfo from '../../profile/user/teams/teaminfo'
import type * as T from '@/constants/types'
import {Bot} from '../conversation/info-panel/bot'
import {TeamAvatar} from '../avatars'
import {inboxWidth} from '../inbox/row/sizes'

type OwnProps = {header?: React.ReactElement | null}

type NameResult = {
  conversationIDKey: T.Chat.ConversationIDKey
  name: string
  sizeType: 'big' | 'small'
  type: 'name'
}

type TextResult = {
  conversationIDKey: T.Chat.ConversationIDKey
  sizeType: 'big' | 'small'
  type: 'text'
  name: string
  numHits: number
  query: string
}

type BotResult = {
  type: 'bot'
  bot: T.RPCGen.FeaturedBot
}

type OpenTeamResult = {
  type: 'openTeam'
  hit: T.Chat.InboxSearchOpenTeamHit
}

type Item = NameResult | TextResult | BotResult | OpenTeamResult

const emptySearch = Chat.makeInboxSearchInfo()

export default function InboxSearchContainer(ownProps: OwnProps) {
  const {_inboxSearch, toggleInboxSearch, inboxSearchSelect} = Chat.useChatState(
    C.useShallow(s => ({
      _inboxSearch: s.inboxSearch ?? emptySearch,
      inboxSearchSelect: s.dispatch.inboxSearchSelect,
      toggleInboxSearch: s.dispatch.toggleInboxSearch,
    }))
  )
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
  const {botsResults: _botsResults, botsResultsSuggested, botsStatus} = _inboxSearch
  const {openTeamsResults: _openTeamsResults, openTeamsResultsSuggested, openTeamsStatus} = _inboxSearch
  const {selectedIndex, textResults: _textResults} = _inboxSearch

  const [botsAll, setBotsAll] = React.useState(false)
  const [botsCollapsed, setBotsCollapsed] = React.useState(false)
  const [nameCollapsed, setNameCollapsed] = React.useState(false)
  const [openTeamsAll, setOpenTeamsAll] = React.useState(false)
  const [openTeamsCollapsed, setOpenTeamsCollapsed] = React.useState(false)
  const [textCollapsed, setTextCollapsed] = React.useState(false)
  const toggleCollapseName = () => setNameCollapsed(s => !s)
  const toggleCollapseText = () => setTextCollapsed(s => !s)
  const toggleCollapseOpenTeams = () => setOpenTeamsCollapsed(s => !s)
  const toggleOpenTeamsAll = () => setOpenTeamsAll(s => !s)
  const toggleCollapseBots = () => setBotsCollapsed(s => !s)
  const toggleBotsAll = () => setBotsAll(s => !s)

  const renderOpenTeams = (h: {item: Item}) => {
    const {item} = h
    if (item.type !== 'openTeam') return null
    const {hit} = item
    return (
      <OpenTeamRow
        description={hit.description}
        name={hit.name}
        memberCount={hit.memberCount}
        inTeam={hit.inTeam}
        publicAdmins={hit.publicAdmins}
        isSelected={false}
      />
    )
  }

  const renderBots = (h: {item: Item; index: number}) => {
    const {item, index} = h
    if (item.type !== 'bot') return null
    return (
      <Chat.ChatProvider id={Chat.noConversationIDKey} key={index} canBeNull={true}>
        <Bot {...item.bot} onClick={onInstallBot} firstItem={index === 0} hideHover={true} />
      </Chat.ChatProvider>
    )
  }

  const selectText = (item: Item, index: number) => {
    if (item.type === 'text') {
      onSelectConversation(item.conversationIDKey, index, item.query)
    }
  }

  const selectBot = (item: Item) => {
    if (item.type !== 'bot') return
    onInstallBot(item.bot.botUsername)
  }

  const renderNameHeader = (section: Section) => {
    return (
      <Kb.SectionDivider
        collapsed={section.isCollapsed}
        label={section.title}
        onToggleCollapsed={section.onCollapse}
        showSpinner={section.status === 'inprogress'}
      />
    )
  }

  const renderHeaderWithMore = (
    section: Section,
    resultsLength: number,
    collapsed: boolean,
    showAll: boolean,
    toggleAll: () => void
  ) => {
    const showMore = resultsLength > 3 && !collapsed
    const label = (
      <Kb.Box2 direction="horizontal" gap="xtiny">
        <Kb.Text type="BodySmallSemibold">{section.title}</Kb.Text>
        {showMore && (
          <Kb.Text
            onClick={(e: React.BaseSyntheticEvent) => {
              e.stopPropagation()
              toggleAll()
            }}
            type="BodySmallSecondaryLink"
          >
            {!showAll ? '(more)' : '(less)'}
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

  const renderTeamHeader = (section: Section) =>
    renderHeaderWithMore(section, _openTeamsResults.length, openTeamsCollapsed, openTeamsAll, toggleOpenTeamsAll)

  const renderBotsHeader = (section: Section) =>
    renderHeaderWithMore(section, _botsResults.length, botsCollapsed, botsAll, toggleBotsAll)

  const renderTextHeader = (section: Section) => {
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

  function renderHit(h: {item: Item; index: number; section: Section}) {
    if (h.item === emptyUnreadPlaceholder) {
      return (
        <Kb.Text style={styles.emptyUnreadPlaceholder} type="BodySmall" center={true}>
          No unread messages or conversations
        </Kb.Text>
      )
    }

    if (h.item.type !== 'text' && h.item.type !== 'name') return null

    const {item, section, index} = h
    const numHits = item.type === 'text' ? item.numHits : undefined
    const realIndex = index + section.indexOffset
    return item.sizeType === 'big' ? (
      <Chat.ChatProvider id={item.conversationIDKey}>
        <SelectableBigTeamChannel
          isSelected={!Kb.Styles.isMobile && selectedIndex === realIndex}
          name={item.name}
          numSearchHits={numHits}
          maxSearchHits={Chat.inboxSearchMaxTextMessages}
          onSelectConversation={() => section.onSelect(item, realIndex)}
        />
      </Chat.ChatProvider>
    ) : (
      <Chat.ChatProvider id={item.conversationIDKey}>
        <SelectableSmallTeam
          isSelected={!Kb.Styles.isMobile && selectedIndex === realIndex}
          name={item.name}
          numSearchHits={numHits}
          maxSearchHits={Chat.inboxSearchMaxTextMessages}
          onSelectConversation={() => section.onSelect(item, realIndex)}
        />
      </Chat.ChatProvider>
    )
  }

  const selectName = (item: Item, index: number) => {
    if (item.type !== 'name') return
    onSelectConversation(item.conversationIDKey, index, '')
    onCancel()
  }

  const nameResults: Array<NameResult> = nameCollapsed
    ? []
    : _nameResults.length
      ? _nameResults.map(
          r =>
            ({
              conversationIDKey: r.conversationIDKey,
              name: r.name,
              sizeType: r.teamType,
              type: 'name',
            }) as const
        )
      : nameResultsUnread
        ? [emptyUnreadPlaceholder]
        : []

  const textResults: Array<TextResult> = textCollapsed
    ? []
    : _textResults.map(
        r =>
          ({
            conversationIDKey: r.conversationIDKey,
            name: r.name,
            numHits: r.numHits,
            query: r.query,
            sizeType: r.teamType,
            type: 'text',
          }) as const
      )

  const openTeamsResults = openTeamsCollapsed
    ? []
    : openTeamsAll
      ? _openTeamsResults
      : _openTeamsResults.slice(0, 3)

  const botsResults = botsCollapsed ? [] : botsAll ? _botsResults : _botsResults.slice(0, 3)
  const indexOffset = botsResults.length + openTeamsResults.length + nameResults.length

  const nameSection: Section = {
    data: nameResults,
    indexOffset: 0,
    isCollapsed: nameCollapsed,
    onCollapse: toggleCollapseName,
    onSelect: selectName,
    renderHeader: renderNameHeader,
    renderItem: renderHit as Section['renderItem'],
    status: nameStatus,
    title: nameResultsUnread ? 'Unread' : 'Chats',
  }
  const openTeamsSection: Section = {
    data: openTeamsResults.map(hit => ({hit, type: 'openTeam'})),
    indexOffset: nameResults.length,
    isCollapsed: openTeamsCollapsed,
    onCollapse: toggleCollapseOpenTeams,
    onSelect: () => {}, // ignored
    renderHeader: renderTeamHeader,
    renderItem: renderOpenTeams,
    status: openTeamsStatus,
    title: openTeamsResultsSuggested ? 'Suggested teams' : 'Open teams',
  }
  const botsSection: Section = {
    data: botsResults.map(bot => ({bot, type: 'bot'})),
    indexOffset: openTeamsResults.length + nameResults.length,
    isCollapsed: botsCollapsed,
    onCollapse: toggleCollapseBots,
    onSelect: selectBot,
    renderHeader: renderBotsHeader,
    renderItem: renderBots as Section['renderItem'],
    status: botsStatus,
    title: botsResultsSuggested ? 'Suggested bots' : 'Featured bots',
  }
  const messagesSection: Section = {
    data: textResults,
    indexOffset,
    isCollapsed: textCollapsed,
    onCollapse: toggleCollapseText,
    onSelect: selectText,
    renderHeader: renderTextHeader,
    renderItem: renderHit as Section['renderItem'],
    status: textStatus,
    title: 'Messages',
  }
  const sections: Array<Section> = [
    nameSection,
    openTeamsSection,
    botsSection,
    ...(!nameResultsUnread ? [messagesSection] : []),
  ]

  return (
    <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
      <Rover />
      <Kb.SectionList
        ListHeaderComponent={header}
        stickySectionHeadersEnabled={true}
        renderSectionHeader={({section}: {section: Section}) => section.renderHeader(section)}
        keyboardShouldPersistTaps="handled"
        sections={sections}
      />
    </Kb.Box2>
  )
}

type SectionExtra = {
  indexOffset: number
  isCollapsed: boolean
  onCollapse: () => void
  onSelect: (item: Item, index: number) => void
  renderHeader: (section: Section) => React.ReactElement
  status: T.Chat.InboxSearchStatus
  title: string
}

type Section = Kb.SectionType<Item> & SectionExtra

const emptyUnreadPlaceholder = {
  conversationIDKey: '',
  name: '---EMPTYRESULT---',
  sizeType: 'small',
  type: 'name',
} as const

const rowHeight = Kb.Styles.isMobile ? 64 : 56
type OpenTeamProps = T.Chat.InboxSearchOpenTeamHit & {isSelected: boolean}
const OpenTeamRow = (p: OpenTeamProps) => {
  const [hovering, setHovering] = React.useState(false)
  const {name, description, memberCount, publicAdmins, inTeam, isSelected} = p
  const showingDueToSelect = React.useRef(false)
  const {joinTeam, showTeamByName} = useTeamsState(
    C.useShallow(s => ({
      joinTeam: s.dispatch.joinTeam,
      showTeamByName: s.dispatch.showTeamByName,
    }))
  )

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <TeamInfo
        attachTo={attachTo}
        description={description}
        inTeam={inTeam}
        isOpen={true}
        name={name}
        membersCount={memberCount}
        position="right center"
        onChat={undefined}
        onHidden={hidePopup}
        onJoinTeam={() => joinTeam(name)}
        onViewTeam={() => {
          clearModals()
          showTeamByName(name)
        }}
        publicAdmins={publicAdmins}
        visible={true}
      />
    )
  }
  const {hidePopup, showingPopup, popup, popupAnchor, showPopup} = Kb.usePopup2(makePopup)

  React.useEffect(() => {
    if (!showingPopup && isSelected && !showingDueToSelect.current) {
      showingDueToSelect.current = true
      showPopup()
    } else if (showingPopup && !isSelected && showingDueToSelect.current) {
      showingDueToSelect.current = false
      hidePopup()
    }
  }, [showingDueToSelect, showPopup, hidePopup, showingPopup, isSelected])

  return (
    <Kb.ClickableBox onClick={showPopup} style={{width: '100%'}}>
      <Kb.Box2Measure
        direction="horizontal"
        fullWidth={true}
        ref={popupAnchor}
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
            style={{color: isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black}}
            title={name}
            lineClamp={Kb.Styles.isMobile ? 1 : undefined}
            ellipsizeMode="tail"
          >
            {name}
          </Kb.Text>
          <Kb.Text
            type="BodySmall"
            style={{color: isSelected ? Kb.Styles.globalColors.white : Kb.Styles.globalColors.black_50}}
            title={`#${description}`}
            lineClamp={1}
            ellipsizeMode="tail"
          >
            {description}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2Measure>
      {popup}
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
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
