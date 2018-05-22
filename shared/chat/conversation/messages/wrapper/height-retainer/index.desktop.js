// @flow
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {resolveRootAsURL} from '../../../../../desktop/resolve-root.desktop'
import {urlsToImgSet} from '../../../../../common-adapters/icon.desktop'
import {Box} from '../../../../../common-adapters'
import {collapseStyles} from '../../../../../styles'
import type {Props} from '.'

const explodedIllustration = resolveRootAsURL('../images/icons/pattern-ashes-desktop-400-68.png')
const explodedIllustrationUrl = urlsToImgSet({'68': explodedIllustration}, 68)

type State = {
  height: ?number,
}
class HeightRetainer extends React.Component<Props, State> {
  state = {height: 17}
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
              backgroundImage: explodedIllustrationUrl,
              backgroundRepeat: 'repeat',
              backgroundSize: '400px 68px',
            },
        ])}
      >
        {!this.props.retainHeight && this.props.children}
      </Box>
    )
  }
}

export default HeightRetainer
