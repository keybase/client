// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/chat2'
import * as Styles from '../../styles'
import SelectableSmallTeam from '../selectable-small-team-container'
import SelectableBigTeamChannel from '../selectable-big-team-channel-container'
import {inboxWidth} from '../inbox/row/sizes'

type NameResult = {|
  conversationIDKey: Types.ConversationIDKey,
  type: 'big' | 'small',
|}

type TextResult = {|
  conversationIDKey: Types.ConversationIDKey,
  type: 'big' | 'small',
  numHits: number,
|}

type Props = {|
  indexPercent: number,
  nameStatus: Types.InboxSearchStatus,
  nameResults: Array<NameResult>,
  onCancel: () => void,
  onSelectConversation: (Types.ConversationIDKey, boolean) => void,
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
        key={realIndex}
        numSearchHits={item?.numHits ?? undefined}
        onSelectConversation={() => section.onSelect(item.conversationIDKey)}
      />
    ) : (
      <SelectableSmallTeam
        conversationIDKey={item.conversationIDKey}
        isSelected={this.props.selectedIndex === realIndex}
        numSearchHits={item?.numHits ?? undefined}
        key={realIndex}
        onSelectConversation={() => section.onSelect(item.conversationIDKey)}
      />
    )
  }
  _toggleCollapseName = () => {
    this.setState({nameCollapsed: !this.state.nameCollapsed})
  }
  _toggleCollapseText = () => {
    this.setState({textCollapsed: !this.state.textCollapsed})
  }
  _selectName = conversationIDKey => {
    this.props.onSelectConversation(conversationIDKey, false)
    this.props.onCancel()
  }
  _selectText = conversationIDKey => {
    this.props.onSelectConversation(conversationIDKey, true)
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
    return (
      <Kb.Box2 style={styles.container} direction="vertical">
        <Kb.SectionList
          stickySectionHeadersEnabled={true}
          renderSectionHeader={this._renderSectionHeader}
          keyExtractor={this._keyExtractor}
          sections={[
            {
              data: this._nameResults(),
              indexOffset: 0,
              isCollapsed: this.state.nameCollapsed,
              onCollapse: this._toggleCollapseName,
              onSelect: this._selectName,
              renderHeader: this._renderNameHeader,
              renderItem: this._renderHit,
              status: this.props.nameStatus,
              title: 'Conversation Name Matches',
            },
            {
              data: this._textResults(),
              indexOffset: this._nameResults().length,
              isCollapsed: this.state.textCollapsed,
              onCollapse: this._toggleCollapseText,
              onSelect: this._selectText,
              renderHeader: this._renderTextHeader,
              renderItem: this._renderHit,
              status: this.props.textStatus,
              title: 'Message Text Matches',
            },
          ]}
        />
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
