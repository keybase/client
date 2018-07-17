// @flow
import * as React from 'react'
import {globalColors, styleSheetCreate} from '../styles'
import Toast from './toast.desktop'
import Text from './text'
import {type Props} from './with-tooltip'

type State = {
  mouseIn: boolean,
  visible: boolean,
  attachmentRef: any,
}

class WithTooltip extends React.Component<Props, State> {
  state = {
    mouseIn: false,
    visible: false,
    attachmentRef: null,
  }
  _onMouseEnter = () => {
    this.setState({mouseIn: true})
  }
  _onMouseLeave = () => {
    this.setState({mouseIn: false, visible: false})
  }
  _setAttachmentRef = attachmentRef => this.setState({attachmentRef})
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
      <div
        style={this.props.containerStyle}
        ref={this._setAttachmentRef}
        onMouseEnter={this._onMouseEnter}
        onMouseLeave={this._onMouseLeave}
      >
        {this.props.children}
        {this.state.mouseIn && (
          <Toast
            containerStyle={this.props.multiline ? styles.containerMultiline : styles.container}
            visible={this.state.visible}
            attachTo={this.state.attachmentRef}
            position={this.props.position || 'top center'}
          >
            <Text type="BodySmall" style={styles.text}>
              {this.props.text}
            </Text>
          </Toast>
        )}
      </div>
    )
  }
}

const styles = styleSheetCreate({
  container: {
    borderRadius: 20,
  },
  containerMultiline: {
    borderRadius: 4,
    width: 320,
    minWidth: 320,
    maxWidth: 320,
  },
  text: {
    color: globalColors.white,
  },
})

export default WithTooltip
