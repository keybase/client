// @flow
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {resolveRootAsURL} from '../../../../../desktop/app/resolve-root.desktop'
import {urlsToImgSet} from '../../../../../common-adapters/icon.desktop'
import {Box, ConnectedUsernames, Text} from '../../../../../common-adapters'
import {
  collapseStyles,
  glamorous,
  globalColors,
  platformStyles,
  styleSheetCreate,
} from '../../../../../styles'
import type {Props} from '.'

const explodedIllustration = resolveRootAsURL('../images/icons/pattern-ashes-desktop-400-68.png')
const explodedIllustrationUrl = urlsToImgSet({'68': explodedIllustration}, 68)

const copyChildren = children =>
  React.Children.map(children, child => (child ? React.cloneElement(child) : child))

const animationDuration = 0.5

const messageHeights = {}

type State = {
  children: ?React.Node,
  height: ?number,
}
class ExplodingHeightRetainer extends React.Component<Props, State> {
  state = {children: copyChildren(this.props.children), height: 17}
  timeoutID: ?TimeoutID = null

  constructor(props: Props) {
    super(props)
    if (messageHeights[props.messageKey]) {
      this.state = {children: copyChildren(props.children), height: messageHeights[props.messageKey]}
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.retainHeight) {
      if (!prevProps.retainHeight && !this.timeoutID) {
        // destroy local copy of children
        this.timeoutID = setTimeout(() => this.setState({children: null}), animationDuration * 1000)
      }
      return
    }
    const node = ReactDOM.findDOMNode(this)
    if (node instanceof window.HTMLElement) {
      const height = node.clientHeight
      if (height && height !== this.state.height) {
        this.setState({height})
      }
      if (!messageHeights[this.props.messageKey] && this.props.exploding) {
        messageHeights[this.props.messageKey] = height
      }
    }
  }

  render() {
    return (
      <Box
        style={collapseStyles([
          this.props.style,
          // paddingRight is to compensate for the message menu
          // to make sure we don't rewrap text when showing the animation
          this.props.retainHeight && {height: this.state.height, paddingRight: 28, position: 'relative'},
        ])}
      >
        {this.state.children}
        <Ashes exploded={this.props.retainHeight} explodedBy={this.props.explodedBy} />
      </Box>
    )
  }
}

const AshBox = glamorous.div(props => ({
  '&.full-width': {
    width: '100%',
  },
  backgroundColor: globalColors.white,
  backgroundImage: explodedIllustrationUrl,
  backgroundRepeat: 'repeat',
  backgroundSize: '400px 68px',
  bottom: 0,
  left: 0,
  overflow: 'hidden',
  position: 'absolute',
  top: 0,
  transition: `width ${animationDuration}s ease-in-out`,
  width: 0,
}))
const Ashes = (props: {exploded: boolean, explodedBy: ?string}) => {
  const explodedTag = props.explodedBy ? (
    <Text type="BodySmall" style={styles.exploded}>
      EXPLODED BY{' '}
      <ConnectedUsernames
        type="BodySmallSemibold"
        clickable={true}
        usernames={[props.explodedBy]}
        inline={true}
        colorFollowing={true}
      />
    </Text>
  ) : (
    <Text type="BodySmall" style={styles.exploded}>
      EXPLODED
    </Text>
  )
  return <AshBox className={props.exploded ? 'full-width' : undefined}>{explodedTag}</AshBox>
}

const styles = styleSheetCreate({
  exploded: platformStyles({
    isElectron: {
      backgroundColor: globalColors.white,
      bottom: 0,
      color: globalColors.black_20_on_white,
      padding: 2,
      paddingTop: 0,
      position: 'absolute',
      right: 0,
      whiteSpace: 'nowrap',
    },
  }),
})

export default ExplodingHeightRetainer
