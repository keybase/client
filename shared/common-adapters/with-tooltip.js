// @flow
import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import ClickableBox from './clickable-box'
import Toast from './toast'
import Text from './text'
import {type Props} from './with-tooltip'

type State = {
  visible: boolean,
}

const LocalBox = Styles.isMobile ? ClickableBox : Box

class WithTooltip extends React.Component<Props, State> {
  state = {
    visible: false,
  }
  _attachmentRef: ?React.Component<any> = null
  _onClick = () => {
    this.setState(prevState => ({visible: !prevState.visible}))
  }
  _onMouseEnter = () => {
    this.setState({visible: true})
  }
  _onMouseLeave = () => {
    this.setState({visible: false})
  }
  _setAttachmentRef = attachmentRef => (this._attachmentRef = attachmentRef)
  render() {
    return (
      <>
        <Toast
          containerStyle={Styles.collapseStyles([
            styles.container,
            this.props.multiline && styles.containerMultiline,
          ])}
          visible={!!this.props.text && this.state.visible}
          attachTo={() => this._attachmentRef}
          position={this.props.position || 'top center'}
        >
          <Text type="BodySmall" style={Styles.collapseStyles([styles.text, this.props.textStyle])}>
            {this.props.text}
          </Text>
        </Toast>
        <LocalBox
          style={this.props.containerStyle}
          ref={this._setAttachmentRef}
          onClick={this._onClick}
          onMouseEnter={this._onMouseEnter}
          onMouseLeave={this._onMouseLeave}
          className={this.props.className}
        >
          {this.props.children}
        </LocalBox>
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    borderRadius: Styles.borderRadius,
  },
  containerMultiline: {
    maxWidth: 320,
    minWidth: 320,
    width: 320,
  },
  text: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      textAlign: 'center',
    },
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
})

export default WithTooltip
