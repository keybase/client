// @flow
import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import Toast from './toast'
import Text from './text'
import {type Props} from './with-tooltip'

type State = {
  mouseIn: boolean,
  visible: boolean,
}

class WithTooltip extends React.Component<Props, State> {
  state = {
    mouseIn: false,
    visible: false,
  }
  _attachmentRef: ?React.Component<any> = null
  _onMouseEnter = () => {
    this.setState({mouseIn: true})
  }
  _onMouseLeave = () => {
    this.setState({mouseIn: false, visible: false})
  }
  _setAttachmentRef = attachmentRef => (this._attachmentRef = attachmentRef)
  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!prevState.mouseIn && this.state.mouseIn) {
      // Set visible after Toast is mounted, to trigger transition on opacity.
      // Note that we aren't doing anything to make ease out work. We don't
      // keep Toast mounted all the time (which would make this unnecessary)
      // because in that case it doesn't follow scrolling.
      this.setState({visible: true})
    }
  }
  render() {
    return (
      <>
        <Box
          style={this.props.containerStyle}
          ref={this._setAttachmentRef}
          onMouseEnter={this._onMouseEnter}
          onMouseLeave={this._onMouseLeave}
          className={this.props.className}
        >
          {this.props.children}
        </Box>
        <Toast
          containerStyle={this.props.multiline ? styles.containerMultiline : styles.container}
          visible={!!this.props.text && this.state.visible}
          attachTo={() => this._attachmentRef}
          position={this.props.position || 'top center'}
        >
          <Text type="BodySmall" style={Styles.collapseStyles([styles.text, this.props.textStyle])}>
            {this.props.text}
          </Text>
        </Toast>
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    borderRadius: 20,
  },
  containerMultiline: {
    borderRadius: 4,
    width: 320,
    minWidth: 320,
    maxWidth: 320,
  },
  text: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      textAlign: 'center',
      wordBreak: 'break-all',
    },
  }),
})

export default WithTooltip
