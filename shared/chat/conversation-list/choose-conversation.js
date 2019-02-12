// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import ConversationList from './conversation-list-container'
import type {Position} from '../../common-adapters/relative-popup-hoc.types'

export type Props = {|
  dropdownButtonDefaultText: string,
  dropdownButtonStyle?: Styles.StylesCrossPlatform,
  overlayStyle?: Styles.StylesCrossPlatform,
  disabled?: boolean,
  position?: Position,
|}

type State = {|expanded: boolean|}

class ChooseConversation extends React.Component<Props & Kb.OverlayParentProps, State> {
  state = {
    expanded: false,
  }
  _toggleOpen = () => {
    this.setState(prevState => ({expanded: !prevState.expanded}))
  }
  _onSelect = () => {
    this.setState({expanded: false})
  }
  render() {
    return (
      <>
        <Kb.DropdownButton
          disabled={this.props.disabled}
          selected={<Kb.Text type="BodySemibold">{this.props.dropdownButtonDefaultText}</Kb.Text>}
          setAttachmentRef={this.props.setAttachmentRef}
          toggleOpen={this._toggleOpen}
          style={Styles.collapseStyles([styles.dropdownButton, this.props.dropdownButtonStyle])}
        />
        <Kb.Overlay
          attachTo={this.props.getAttachmentRef}
          onHidden={this._toggleOpen}
          position={this.props.position || 'center center'}
          style={Styles.collapseStyles([styles.overlay, this.props.overlayStyle])}
          visible={this.state.expanded}
        >
          <ConversationList onSelect={this._onSelect} />
        </Kb.Overlay>
      </>
    )
  }
}

export default Kb.OverlayParentHOC(ChooseConversation)

const styles = Styles.styleSheetCreate({
  dropdownButton: {
    width: 240,
  },
  overlay: {
    backgroundColor: Styles.globalColors.white,
    height: 350,
    width: 240,
  },
})
