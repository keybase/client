// @flow
import * as React from 'react'
import Tooltip from './tooltip.desktop'
import {type Props} from './with-tooltip'

type State = {
  mouseIn: boolean,
  attachmentRef: any,
}

class WithTooltip extends React.Component<Props, State> {
  state = {
    mouseIn: false,
    attachmentRef: null,
  }
  _onMouseEnter = () => {
    this.setState({mouseIn: true})
  }
  _onMouseLeave = () => {
    this.setState({mouseIn: false})
  }
  _setAttachmentRef = attachmentRef => this.setState({attachmentRef})
  render() {
    return (
      <div
        style={this.props.containerStyle}
        ref={this._setAttachmentRef}
        onMouseEnter={this._onMouseEnter}
        onMouseLeave={this._onMouseLeave}
      >
        {this.props.children}
        <Tooltip
          visible={this.state.mouseIn}
          attachTo={this.state.attachmentRef}
          text={this.props.text}
          multiline={this.props.multiline}
          position={this.props.position}
        />
      </div>
    )
  }
}

export default WithTooltip
