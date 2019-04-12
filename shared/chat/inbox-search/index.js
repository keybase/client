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
  nameStatus: Types.InboxSearchStatus,
  nameResults: Array<NameResult>,
  onCancel: () => void,
  onSelectConversation: Types.ConversationIDKey => void,
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
  _renderNameHit = ({item, section, index}) => {
    const onSelectConversation = doCancel => {
      if (doCancel) {
        this.props.onCancel()
      }
      this.props.onSelectConversation(item.conversationIDKey)
    }
    return item.type === 'big' ? (
      <SelectableBigTeamChannel
        conversationIDKey={item.conversationIDKey}
        isSelected={this.props.selectedIndex === index}
        key={index}
        onSelectConversation={() => onSelectConversation(true)}
      />
    ) : (
      <SelectableSmallTeam
        conversationIDKey={item.conversationIDKey}
        isSelected={this.props.selectedIndex === index}
        key={index}
        onSelectConversation={() => onSelectConversation(true)}
      />
    )
  }
  _toggleCollapseName = () => {
    this.setState({nameCollapsed: !this.state.nameCollapsed})
  }
  _toggleCollapseText = () => {
    this.setState({textCollapsed: !this.state.textCollapsed})
  }
  _renderSectionHeader = ({section}) => {
    return (
      <Kb.SectionDivider
        collapsed={section.isCollapsed}
        label={section.title}
        onToggleCollapsed={section.onCollapse}
      />
    )
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
              isCollapsed: this.state.nameCollapsed,
              onCollapse: this._toggleCollapseName,
              renderItem: this._renderNameHit,
              title: 'Conversation Name Matches',
            },
            {
              data: this._textResults(),
              isCollapsed: this.state.textCollapsed,
              onCollapse: this._toggleCollapseText,
              renderItem: this._renderNameHit,
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
})

export default InboxSearch
