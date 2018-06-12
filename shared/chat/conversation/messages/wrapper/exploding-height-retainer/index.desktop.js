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

const animationDuration = 1.5

const retainedHeights = {}

type State = {
  children: ?React.Node,
  height: number,
}
class ExplodingHeightRetainer extends React.Component<Props, State> {
  state = {children: copyChildren(this.props.children), height: 17}
  timeoutID: ?TimeoutID = null

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    return nextProps.retainHeight ? null : {children: copyChildren(nextProps.children)}
  }

  componentDidMount() {
    // remeasure if we are already exploded
    if (this.props.retainHeight && retainedHeights[this.props.messageKey] && this.props.measure) {
      this.props.measure()
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.retainHeight) {
      if (!prevProps.retainHeight && !this.timeoutID) {
        // destroy local copy of children when animation finishes
        this.timeoutID = setTimeout(() => this.setState({children: null}), animationDuration * 1000)
      }
      return
    }
    const node = ReactDOM.findDOMNode(this)
    if (node instanceof window.HTMLElement) {
      const height = node.clientHeight
      if (height && height !== this.state.height) {
        retainedHeights[this.props.messageKey] = true
        this.setState({height})
      }
    }
  }

  componentWillUnmount() {
    if (this.timeoutID) {
      clearTimeout(this.timeoutID)
      this.timeoutID = null
    }
  }

  render() {
    return (
      <Box
        style={collapseStyles([
          this.props.style,
          // paddingRight is to compensate for the message menu
          // to make sure we don't rewrap text when showing the animation
          this.props.retainHeight && {
            height: this.state.height,
            paddingRight: 28,
            position: 'relative',
            overflow: 'hidden',
          },
        ])}
      >
        {this.state.children}
        <Ashes
          doneExploding={!this.state.children}
          exploded={this.props.retainHeight}
          explodedBy={this.props.explodedBy}
          height={this.state.height}
        />
      </Box>
    )
  }
}

const AshBox = glamorous.div(props => ({
  '&.full-width': {
    width: '100%',
    overflow: 'visible',
    transition: `width ${animationDuration}s ease-in-out`,
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
  transition: `width 0s`,
  width: 0,
}))
const Ashes = (props: {doneExploding: boolean, exploded: boolean, explodedBy: ?string, height: number}) => {
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
  return (
    <AshBox className={props.exploded ? 'full-width' : undefined}>
      {explodedTag}
      <FlameFront height={props.height} stop={props.doneExploding} />
    </AshBox>
  )
}

const maxFlameWidth = 20
const FlameFront = (props: {height: number, stop: boolean}) => {
  const numBoxes = Math.ceil(props.height / 17)
  const children = []
  for (let i = 0; i < numBoxes; i++) {
    children.push(<Flame key={i} stop={props.stop} />)
  }
  return (
    <Box className="flame-container" style={styles.flameContainer}>
      {children}
    </Box>
  )
}

const colors = [globalColors.red, globalColors.yellow, globalColors.grey]
const randWidth = () => Math.round(Math.random() * maxFlameWidth)
const randColor = () => colors[Math.floor(Math.random() * colors.length)]

class Flame extends React.Component<{stop: boolean}, {color: string, width: number}> {
  state = {color: randColor(), width: randWidth()}
  intervalID: ?IntervalID
  shouldComponentUpdate(nextProps, nextState) {
    if (this.state.width !== nextState.width || this.state.color !== nextState.color) {
      return true
    }
    return this.props.stop !== nextProps.stop
  }

  componentDidMount() {
    if (!this.props.stop) {
      this.intervalID = setInterval(() => this.setState({color: randColor(), width: randWidth()}), 100)
    }
  }

  componentDidUpate() {
    if (this.props.stop && this.intervalID) {
      clearInterval(this.intervalID)
      this.intervalID = null
    }
  }

  componentWillUnmount() {
    if (this.intervalID) {
      clearInterval(this.intervalID)
      this.intervalID = null
    }
  }

  render() {
    return (
      <Box
        style={{
          backgroundColor: this.state.color,
          width: this.state.width,
          height: 15,
          marginTop: 1,
          marginBottom: 1,
          opacity: 0.9,
        }}
      />
    )
  }
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
  flameContainer: {
    width: maxFlameWidth,
    position: 'absolute',
    right: -1 * maxFlameWidth,
  },
})

export default ExplodingHeightRetainer
