// @flow
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {Box} from '../../../../../common-adapters'
import {collapseStyles} from '../../../../../styles'
import type {Props} from '.'

const explodedIllustration = '../../../../../images/icons/icon-illustration-message-exploded-663-x-38.png'

type State = {
  height: ?number,
}
class HeightRetainer extends React.Component<Props, State> {
  state = {height: null}
  componentDidUpdate() {
    if (this.props.retainHeight) {
      return
    }
    const node = ReactDOM.findDOMNode(this)
    if (node instanceof window.HTMLElement) {
      const height = node.clientHeight
      if (height && height !== this.state.height) {
        this.setState({height})
      }
    }
  }

  render() {
    return (
      <Box
        style={collapseStyles([
          this.props.style,
          !!this.state.height &&
            this.props.retainHeight && {
              height: this.state.height,
              backgroundImage: explodedIllustration,
              backgroundRepeat: 'repeat',
            },
        ])}
      >
        {!this.props.retainHeight && this.props.children}
      </Box>
    )
  }
}

export default HeightRetainer
