import * as React from 'react'
import * as Types from '../../constants/types/chat2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import ConversationList from './conversation-list-container'

type Props = {
  dropdownButtonStyle?: Styles.StylesCrossPlatform | null
  filter?: string
  onSelect: (conversationIDKey: Types.ConversationIDKey) => void
  onSetFilter?: (filter: string) => void
  selected: Types.ConversationIDKey
  selectedText: string
}

type State = {
  expanded: boolean
}

class ChooseConversation extends React.Component<Props & Kb.OverlayParentProps, State> {
  state = {
    expanded: false,
  }
  _toggleOpen = () => {
    this.setState(prevState => ({expanded: !prevState.expanded}))
  }
  _onDone = () => this.setState({expanded: false})
  render() {
    return (
      <>
        <Kb.DropdownButton
          selected={<Kb.Text type="BodySemibold">{this.props.selectedText}</Kb.Text>}
          setAttachmentRef={this.props.setAttachmentRef}
          toggleOpen={this._toggleOpen}
          style={Styles.collapseStyles([styles.dropdownButton, this.props.dropdownButtonStyle])}
        />
        <Kb.Overlay
          attachTo={this.props.getAttachmentRef}
          onHidden={this._toggleOpen}
          position="center center"
          style={styles.overlay}
          visible={this.state.expanded}
        >
          <ConversationList
            onSelect={this.props.onSelect}
            onDone={this._onDone}
            filter={this.props.filter}
            focusFilterOnMount={true}
            onSetFilter={this.props.onSetFilter}
            selected={this.props.selected}
          />
        </Kb.Overlay>
      </>
    )
  }
}

export default Kb.OverlayParentHOC(ChooseConversation)

const styles = Styles.styleSheetCreate({
  dropdownButton: {
    width: 300,
  },
  overlay: {
    backgroundColor: Styles.globalColors.white,
    height: 360,
    width: 300,
  },
})
