import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as Styles from '../../styles'
import SelectableSmallTeam from '../selectable-small-team-container'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import {inboxWidth} from '../inbox/row/sizes'
import Rover from './background'

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
  nameStatus: Types.InboxSearchStatus
  nameResults: Array<NameResult>
  nameResultsUnread: boolean
  onCancel: () => void
  onSelectConversation: (arg0: Types.ConversationIDKey, arg1: number, arg2: string) => void
  selectedIndex: number
  textStatus: Types.InboxSearchStatus
  textResults: Array<TextResult>
  query: string
}

type State = {
  nameCollapsed: boolean
  textCollapsed: boolean
}

class InboxSearch extends React.Component<Props, State> {
  state = {nameCollapsed: false, textCollapsed: false}

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
  private renderSectionHeader = ({section}: unknown) => {
    return section.renderHeader(section)
  }
  private keyExtractor = (_: unknown, index: number) => index
  private nameResults = () => {
    return this.state.nameCollapsed ? [] : this.props.nameResults
  }
  private textResults = () => {
    return this.state.textCollapsed ? [] : this.props.textResults
  }

  render() {
    const textResults = this.textResults()
    const nameResults = this.nameResults()
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
      ...(!this.props.nameResultsUnread
        ? [
            {
              data: textResults,
              indexOffset: nameResults.length,
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
      percentContainer: {
        padding: Styles.globalMargins.tiny,
      },
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
