import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import Rover from './background'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import SelectableSmallTeam from '../selectable-small-team-container'
import TeamInfo from '../../profile/user/teams/teaminfo'
import type * as T from '@/constants/types'
import type {Section as _Section} from '@/common-adapters/section-list'
import {Bot} from '../conversation/info-panel/bot'
import {TeamAvatar} from '../avatars'
import {inboxWidth} from '../inbox/row/sizes'

type OwnProps = {header?: React.ReactElement | null}

const emptySearch = C.Chat.makeInboxSearchInfo()

export default React.memo(function InboxSearchContainer(ownProps: OwnProps) {
  const _inboxSearch = C.useChatState(s => s.inboxSearch ?? emptySearch)
  const toggleInboxSearch = C.useChatState(s => s.dispatch.toggleInboxSearch)
  const inboxSearchSelect = C.useChatState(s => s.dispatch.inboxSearchSelect)
  const onCancel = React.useCallback(() => {
    toggleInboxSearch(false)
  }, [toggleInboxSearch])
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onInstallBot = React.useCallback(
    (username: string) => {
      navigateAppend({props: {botUsername: username}, selected: 'chatInstallBotPick'})
    },
    [navigateAppend]
  )
  const onSelectConversation = React.useCallback(
    (conversationIDKey: T.Chat.ConversationIDKey, selectedIndex: number, query: string) => {
      inboxSearchSelect(conversationIDKey, query.length > 0 ? query : undefined, selectedIndex)
    },
    [inboxSearchSelect]
  )
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
  const toggleCollapseName = React.useCallback(() => {
    setNameCollapsed(s => !s)
  }, [])
  const toggleCollapseText = React.useCallback(() => {
    setTextCollapsed(s => !s)
  }, [])
  const toggleCollapseOpenTeams = React.useCallback(() => {
    setOpenTeamsCollapsed(s => !s)
  }, [])
  const toggleOpenTeamsAll = React.useCallback(() => {
    setOpenTeamsAll(s => !s)
  }, [])
  const toggleCollapseBots = React.useCallback(() => {
    setBotsCollapsed(s => !s)
  }, [])
  const toggleBotsAll = React.useCallback(() => {
    setBotsAll(s => !s)
  }, [])

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

  const renderBots = (h: {item: T.RPCGen.FeaturedBot; section: {indexOffset: number}; index: number}) => {
    const {item, index} = h
    return (
      <C.ChatProvider id={C.Chat.noConversationIDKey} key={index} canBeNull={true}>
        <Bot {...item} onClick={onInstallBot} firstItem={index === 0} hideHover={true} />
      </C.ChatProvider>
    )
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

  const renderTeamHeader = (section: Section<T.Chat.InboxSearchOpenTeamHit>) => {
    const showMore = _openTeamsResults.length > 3 && !openTeamsCollapsed
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

  const renderBotsHeader = (section: Section<T.RPCGen.FeaturedBot>) => {
    const showMore = _botsResults.length > 3 && !botsCollapsed
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

  const keyExtractor = (
    _: T.RPCGen.FeaturedBot | T.Chat.InboxSearchOpenTeamHit | NameResult | TextResult,
    index: number
  ) => String(index)

  const renderHit = (h: {
    item: unknown // TextResult | NameResult
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

    const {item: _item, section, index} = h
    const item = _item as TextResult | NameResult
    const numHits = item.numHits || undefined
    const realIndex = index + section.indexOffset
    return item.type === 'big' ? (
      <C.ChatProvider id={item.conversationIDKey}>
        <SelectableBigTeamChannel
          isSelected={!Kb.Styles.isMobile && selectedIndex === realIndex}
          name={item.name}
          numSearchHits={numHits}
          maxSearchHits={C.Chat.inboxSearchMaxTextMessages}
          onSelectConversation={() => section.onSelect(item, realIndex)}
        />
      </C.ChatProvider>
    ) : (
      <C.ChatProvider id={item.conversationIDKey}>
        <SelectableSmallTeam
          isSelected={!Kb.Styles.isMobile && selectedIndex === realIndex}
          name={item.name}
          numSearchHits={numHits}
          maxSearchHits={C.Chat.inboxSearchMaxTextMessages}
          onSelectConversation={() => section.onSelect(item, realIndex)}
        />
      </C.ChatProvider>
    )
  }

  const selectName = (item: NameResult, index: number) => {
    onSelectConversation(item.conversationIDKey, index, '')
    onCancel()
  }

  const nameResults: Array<NameResult> = nameCollapsed
    ? []
    : _nameResults.length
      ? _nameResults.map(r => ({
          conversationIDKey: r.conversationIDKey,
          name: r.name,
          type: r.teamType,
        }))
      : nameResultsUnread
        ? [emptyUnreadPlaceholder]
        : []

  const textResults = textCollapsed
    ? []
    : _textResults.map(r => ({
        conversationIDKey: r.conversationIDKey,
        name: r.name,
        numHits: r.numHits,
        query: r.query,
        type: r.teamType,
      }))

  const openTeamsResults = openTeamsCollapsed
    ? []
    : openTeamsAll
      ? _openTeamsResults
      : _openTeamsResults.slice(0, 3)

  const botsResults = botsCollapsed ? [] : botsAll ? _botsResults : _botsResults.slice(0, 3)
  const indexOffset = botsResults.length + openTeamsResults.length + nameResults.length

  const nameSection: Section<NameResult> = {
    data: nameResults,
    indexOffset: 0,
    isCollapsed: nameCollapsed,
    onCollapse: toggleCollapseName,
    onSelect: selectName,
    renderHeader: renderNameHeader,
    // TODO fix types
    renderItem: renderHit as any,
    status: nameStatus,
    title: nameResultsUnread ? 'Unread' : 'Chats',
  }
  const openTeamsSection: Section<T.Chat.InboxSearchOpenTeamHit> = {
    data: openTeamsResults,
    indexOffset: nameResults.length,
    isCollapsed: openTeamsCollapsed,
    onCollapse: toggleCollapseOpenTeams,
    // TODO fix types
    onSelect: selectText as any,
    renderHeader: renderTeamHeader,
    renderItem: renderOpenTeams,
    status: openTeamsStatus,
    title: openTeamsResultsSuggested ? 'Suggested teams' : 'Open teams',
  }
  const botsSection: Section<T.RPCGen.FeaturedBot> = {
    data: botsResults,
    indexOffset: openTeamsResults.length + nameResults.length,
    isCollapsed: botsCollapsed,
    onCollapse: toggleCollapseBots,
    onSelect: selectBot,
    renderHeader: renderBotsHeader,
    renderItem: renderBots,
    status: botsStatus,
    title: botsResultsSuggested ? 'Suggested bots' : 'Featured bots',
  }
  const messagesSection: Section<TextResult> = {
    data: textResults,
    indexOffset,
    isCollapsed: textCollapsed,
    onCollapse: toggleCollapseText,
    onSelect: selectText,
    renderHeader: renderTextHeader,
    // TODO better types
    renderItem: renderHit as any,
    status: textStatus,
    title: 'Messages',
  }
  const sections = [
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
        renderSectionHeader={({section}) => section.renderHeader(section as any)}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        sections={sections}
      />
    </Kb.Box2>
  )
})

type NameResult = {
  conversationIDKey: T.Chat.ConversationIDKey
  name: string
  type: 'big' | 'small'
  numHits?: undefined
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
  renderHeader: (section: Section<T>) => React.ReactElement
  status: T.Chat.InboxSearchStatus
  title: string
}
type Section<T> = _Section<T, SectionExtra<T>>

const emptyUnreadPlaceholder = {conversationIDKey: '', name: '---EMPTYRESULT---', type: 'small' as const}

const rowHeight = Kb.Styles.isMobile ? 64 : 56
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
    },
    [showTeamByName, joinTeam, description, inTeam, memberCount, name, publicAdmins, clearModals]
  )
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
