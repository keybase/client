import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/chat2'
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
import flags from '../../util/feature-flags'
import TeamInfo from '../../profile/user/teams/teaminfo'

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

export type Props = {
  header?: React.ReactNode
  indexPercent: number
  nameResults: Array<NameResult>
  nameResultsUnread: boolean
  nameStatus: Types.InboxSearchStatus
  onCancel: () => void
  onSelectConversation: (arg0: Types.ConversationIDKey, arg1: number, arg2: string) => void
  openTeamsResults: Array<Types.InboxSearchOpenTeamHit>
  openTeamsStatus: Types.InboxSearchStatus
  query: string
  selectedIndex: number
  textResults: Array<TextResult>
  textStatus: Types.InboxSearchStatus
}

type State = {
  nameCollapsed: boolean
  textCollapsed: boolean
  openTeamsCollapsed: boolean
}

class InboxSearch extends React.Component<Props, State> {
  state = {nameCollapsed: false, openTeamsCollapsed: false, textCollapsed: false}

  private renderOpenTeams = (h: {
    item: Types.InboxSearchOpenTeamHit
    section: {indexOffset: number; onSelect: any}
    index: number
  }) => {
    const {item, index, section} = h
    const realIndex = index + section.indexOffset
    return (
      <OpenTeamRow
        description={item.description}
        name={item.name}
        id={item.id}
        memberCount={item.memberCount}
        inTeam={item.inTeam}
        publicAdmins={item.publicAdmins}
        isSelected={!Styles.isMobile && this.props.selectedIndex === realIndex}
      />
    )
  }

  private renderHit = (h: {
    item: TextResult
    section: {indexOffset: number; onSelect: any}
    index: number
  }) => {
    const {item, section, index} = h
    const realIndex = index + section.indexOffset
    return item.type === 'big' ? (
      <SelectableBigTeamChannel
        conversationIDKey={item.conversationIDKey}
        isSelected={!Styles.isMobile && this.props.selectedIndex === realIndex}
        name={item.name}
        numSearchHits={item?.numHits}
        maxSearchHits={Constants.inboxSearchMaxTextMessages}
        onSelectConversation={() => section.onSelect(item, realIndex)}
      />
    ) : (
      <SelectableSmallTeam
        conversationIDKey={item.conversationIDKey}
        isSelected={!Styles.isMobile && this.props.selectedIndex === realIndex}
        name={item.name}
        numSearchHits={item?.numHits}
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
  private selectName = (item: NameResult, index: number) => {
    this.props.onSelectConversation(item.conversationIDKey, index, '')
    this.props.onCancel()
  }
  private selectText = (item: TextResult, index: number) => {
    this.props.onSelectConversation(item.conversationIDKey, index, item.query)
  }
  private renderNameHeader = (section: any) => {
    return (
      <Kb.SectionDivider
        collapsed={section.isCollapsed}
        label={section.title}
        onToggleCollapsed={section.onCollapse}
        showSpinner={section.status === 'inprogress'}
      />
    )
  }
  private renderTextHeader = (section: any) => {
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
  private renderSectionHeader = ({section}: any) => {
    return section.renderHeader(section)
  }
  private keyExtractor = (_: unknown, index: number) => index

  render() {
    const nameResults = this.state.nameCollapsed ? [] : this.props.nameResults
    const textResults = this.state.textCollapsed ? [] : this.props.textResults
    const openTeamsResults = this.state.openTeamsCollapsed ? [] : this.props.openTeamsResults

    const indexOffset = flags.openTeamSearch
      ? openTeamsResults.length + nameResults.length
      : nameResults.length

    const sections = [
      {
        data: nameResults,
        indexOffset: 0,
        isCollapsed: this.state.nameCollapsed,
        onCollapse: this.toggleCollapseName,
        onSelect: this.selectName,
        renderHeader: this.renderNameHeader,
        renderItem: this.renderHit,
        status: this.props.nameStatus,
        title: this.props.nameResultsUnread ? 'Unread' : 'Chats',
      },
      ...(flags.openTeamSearch && !this.props.nameResultsUnread
        ? [
            {
              data: openTeamsResults,
              indexOffset: nameResults.length,
              isCollapsed: this.state.openTeamsCollapsed,
              onCollapse: this.toggleCollapseOpenTeams,
              onSelect: this.selectText,
              renderHeader: this.renderNameHeader,
              renderItem: this.renderOpenTeams,
              status: this.props.openTeamsStatus,
              title: 'Open Teams',
            },
          ]
        : []),
      ...(!this.props.nameResultsUnread
        ? [
            {
              data: textResults,
              indexOffset,
              isCollapsed: this.state.textCollapsed,
              onCollapse: this.toggleCollapseText,
              onSelect: this.selectText,
              renderHeader: this.renderTextHeader,
              renderItem: this.renderHit,
              status: this.props.textStatus,
              title: 'Messages',
            },
          ]
        : []),
    ]

    return (
      <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
        <Rover />
        <Kb.SectionList
          ListHeaderComponent={this.props.header}
          stickySectionHeadersEnabled={true}
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
  const {name, description, memberCount, publicAdmins, id, inTeam, isSelected} = p
  const dispatch = Container.useDispatch()
  const popupAnchor = React.useRef(null)
  const showingDueToSelect = React.useRef(false)
  const {showingPopup, setShowingPopup, popup} = Kb.usePopup(popupAnchor, () => (
    <TeamInfo
      attachTo={() => popupAnchor.current}
      description={description ?? ''}
      inTeam={inTeam}
      isOpen={true}
      name={name}
      membersCount={memberCount}
      position="right center"
      onChat={undefined}
      onHidden={() => setShowingPopup(false)}
      onJoinTeam={() => dispatch(TeamsGen.createJoinTeam({teamname: name}))}
      onViewTeam={() => {
        dispatch(RouteTreeGen.createClearModals())
        dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID: id}, selected: 'team'}]}))
      }}
      publicAdmins={publicAdmins ?? []}
      visible={showingPopup}
    />
  ))

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
    <Kb.ClickableBox onClick={() => setShowingPopup(!showingPopup)} style={{width: '100%'}}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        ref={popupAnchor}
        centerChildren={true}
        className="hover_background_color_blueGreyDark"
        style={Styles.collapseStyles([
          {
            backgroundColor: isSelected ? Styles.globalColors.blue : Styles.globalColors.white,
            height: rowHeight,
            paddingLeft: Styles.globalMargins.xtiny,
            paddingRight: Styles.globalMargins.xtiny,
          },
        ])}
        onMouseLeave={() => setHovering(false)}
        onMouseOver={() => setHovering(true)}
      >
        <TeamAvatar teamname={name} isMuted={false} isSelected={isSelected} isHovered={hovering} />
        <Kb.Box2 direction="vertical" style={{flexGrow: 1}}>
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
      errorText: {
        color: Styles.globalColors.redDark,
      },
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
