// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/chat2'
import * as Constants from '../../constants/chat2'
import * as Styles from '../../styles'
import SelectableSmallTeam from '../selectable-small-team-container'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import {inboxWidth} from '../inbox/row/sizes'
import {Owl} from '../inbox/owl'

type NameResult = {|
  conversationIDKey: Types.ConversationIDKey,
  type: 'big' | 'small',
|}

type TextResult = {|
  conversationIDKey: Types.ConversationIDKey,
  type: 'big' | 'small',
  numHits: number,
  query: string,
|}

type Props = {|
  header?: React.Node,
  indexPercent: number,
  nameStatus: Types.InboxSearchStatus,
  nameResults: Array<NameResult>,
  nameResultsUnread: boolean,
  onCancel: () => void,
  onSelectConversation: (Types.ConversationIDKey, number, string) => void,
  selectedIndex: number,
  textStatus: Types.InboxSearchStatus,
  textResults: Array<TextResult>,
|}

type State = {
  nameCollapsed: boolean,
  textCollapsed: boolean,
}

class InboxSearch extends React.Component<Props, State> {
  state = {nameCollapsed: false, textCollapsed: false}

  _renderHit = ({item, section, index}) => {
    const realIndex = index + section.indexOffset
    return item.type === 'big' ? (
      <SelectableBigTeamChannel
        conversationIDKey={item.conversationIDKey}
        isSelected={this.props.selectedIndex === realIndex}
        numSearchHits={item?.numHits ?? undefined}
        maxSearchHits={Constants.inboxSearchMaxTextMessages}
        onSelectConversation={() => section.onSelect(item, realIndex)}
      />
    ) : (
      <SelectableSmallTeam
        conversationIDKey={item.conversationIDKey}
        isSelected={this.props.selectedIndex === realIndex}
        numSearchHits={item?.numHits ?? undefined}
        maxSearchHits={Constants.inboxSearchMaxTextMessages}
        onSelectConversation={() => section.onSelect(item, realIndex)}
      />
    )
  }
  _toggleCollapseName = () => {
    this.setState({nameCollapsed: !this.state.nameCollapsed})
  }
  _toggleCollapseText = () => {
    this.setState({textCollapsed: !this.state.textCollapsed})
  }
  _selectName = (item, index) => {
    this.props.onSelectConversation(item.conversationIDKey, index, '')
    this.props.onCancel()
  }
  _selectText = (item, index) => {
    this.props.onSelectConversation(item.conversationIDKey, index, item.query)
  }
  _renderNameHeader = section => {
    return (
      <Kb.SectionDivider
        collapsed={section.isCollapsed}
        label={section.title}
        onToggleCollapsed={section.onCollapse}
        showSpinner={section.status === 'inprogress'}
      />
    )
  }
  _renderTextHeader = section => {
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.textHeader}>
        <Kb.SectionDivider
          collapsed={section.isCollapsed}
          label={section.title}
          onToggleCollapsed={section.onCollapse}
          showSpinner={section.status === 'inprogress'}
        />
        {this.props.indexPercent > 0 && (
          <Kb.Text type="BodySmall" style={styles.indexPercent}>
            Indexing {this.props.indexPercent}% complete...
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  }
  _renderSectionHeader = ({section}) => {
    return section.renderHeader(section)
  }
  _keyExtractor = (item, index) => index
  _nameResults = () => {
    return this.state.nameCollapsed ? [] : this.props.nameResults
  }
  _textResults = () => {
    return this.state.textCollapsed ? [] : this.props.textResults
  }

  render() {
    const textResults = this._textResults()
    const nameResults = this._nameResults()
    const noResults =
      this.props.nameStatus === 'done' &&
      this.props.textStatus === 'done' &&
      this.props.nameResults.length === 0 &&
      this.props.textResults.length === 0
    const sections = [
      {
        data: nameResults,
        indexOffset: 0,
        isCollapsed: this.state.nameCollapsed,
        onCollapse: this._toggleCollapseName,
        onSelect: this._selectName,
        renderHeader: this._renderNameHeader,
        renderItem: this._renderHit,
        status: this.props.nameStatus,
        title: this.props.nameResultsUnread ? 'Recent' : 'Chats',
      },
    ]
    if (!this.props.nameResultsUnread) {
      sections.push({
        data: textResults,
        indexOffset: nameResults.length,
        isCollapsed: this.state.textCollapsed,
        onCollapse: this._toggleCollapseText,
        onSelect: this._selectText,
        renderHeader: this._renderTextHeader,
        renderItem: this._renderHit,
        status: this.props.textStatus,
        title: 'Messages',
      })
    }
    return (
      <Kb.Box2 style={styles.container} direction="vertical" fullWidth={true}>
        {noResults ? (
          <Owl />
        ) : (
          <Kb.SectionList
            ListHeaderComponent={this.props.header}
            stickySectionHeadersEnabled={true}
            renderSectionHeader={this._renderSectionHeader}
            keyExtractor={this._keyExtractor}
            keyboardShouldPersistTaps="handled"
            sections={sections}
          />
        )}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
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
  }),
  indexPercent: {
    paddingLeft: Styles.globalMargins.small,
  },
  textHeader: {
    backgroundColor: Styles.globalColors.blue5,
  },
})

export default InboxSearch
