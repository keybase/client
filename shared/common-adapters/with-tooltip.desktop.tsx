import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import Toast from './toast'
import Text from './text'
import {Props} from './with-tooltip'

type State = {
  mouseIn: boolean
  visible: boolean
  attachmentRef: React.Component<any> | null
}

class WithTooltip extends React.Component<Props, State> {
  state = {
    attachmentRef: null,
    mouseIn: false,
    visible: false,
  }
  _onMouseEnter = () => {
    this.setState({mouseIn: true})
  }
  _onMouseLeave = () => {
    this.setState({mouseIn: false, visible: false})
  }
  _setAttachmentRef = attachmentRef => this.setState({attachmentRef})
  _getAttachmentRef = () => this.state.attachmentRef
  componentDidUpdate(_: Props, prevState: State) {
    if (!prevState.mouseIn && this.state.mouseIn) {
      // Set visible after Toast is mounted, to trigger transition on opacity.
      // Note that we aren't doing anything to make ease out work. We don't
      // keep Toast mounted all the time (which would make this unnecessary)
      // because in that case the position of the overlay can be messed up when
      // not visible, causing ghost unclickable areas.
      this.setState({visible: true})
    }
  }
  render() {
    return (
      <>
        <Box
          style={this.props.containerStyle}
          forwardedRef={this._setAttachmentRef}
          onMouseOver={this._onMouseEnter}
          onMouseLeave={this._onMouseLeave}
          className={this.props.className}
        >
          {this.props.children}
        </Box>
        {!this.props.disabled && this.state.mouseIn && (
          <Toast
            containerStyle={Styles.collapseStyles([
              styles.container,
              this.props.multiline && styles.containerMultiline,
            ])}
            visible={!!this.props.text && this.state.visible}
            attachTo={this._getAttachmentRef}
            position={this.props.position || 'top center'}
            className={this.props.toastClassName}
          >
            <Text
              center={!Styles.isMobile}
              type="BodySmall"
              style={Styles.collapseStyles([styles.text, this.props.textStyle])}
            >
              {this.props.text}
            </Text>
          </Toast>
        )}
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      borderRadius: Styles.borderRadius,
      pointerEvents: 'none',
    },
  }),
  containerMultiline: {
    maxWidth: 320,
    minWidth: 320,
    width: 320,
  },
  text: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      wordBreak: 'break-word',
    },
  }),
})

export default WithTooltip
