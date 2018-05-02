// @flow
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {resolveRootAsURL} from '../../../../../desktop/resolve-root'
import {urlsToImgSet} from '../../../../../common-adapters/icon.desktop'
import {Box} from '../../../../../common-adapters'
import {collapseStyles} from '../../../../../styles'
import type {Props} from '.'

const explodedIllustration = resolveRootAsURL('../images/icons/icon-shh-24.png')
const explodedIllustrationUrl = urlsToImgSet({'24': explodedIllustration}, 24)

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
              backgroundImage: explodedIllustrationUrl,
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
