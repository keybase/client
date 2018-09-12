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
import type {Props} from './index.types'
import SharedTimer, {type SharedTimerID} from '../../../../../util/shared-timers'

const explodedIllustration = resolveRootAsURL('../images/icons/pattern-ashes-desktop-400-68.png')
const explodedIllustrationUrl = urlsToImgSet({'68': explodedIllustration}, 68)

const copyChildren = children =>
  React.Children.map(children, child => (child ? React.cloneElement(child) : child))

export const animationDuration = 1500

const retainedHeights = {}

type State = {
  animating: boolean,
  children: ?React.Node,
  height: number,
}
class ExplodingHeightRetainer extends React.Component<Props, State> {
  state = {animating: false, children: copyChildren(this.props.children), height: 17}
  timerID: SharedTimerID

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    return nextProps.retainHeight ? null : {children: copyChildren(nextProps.children)}
  }

  componentDidMount() {
    // remeasure if we are already exploded
    if (this.props.retainHeight && retainedHeights[this.props.messageKey] && this.props.measure) {
      delete retainedHeights[this.props.messageKey]
      this.props.measure()
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.retainHeight) {
      if (!prevProps.retainHeight) {
        // destroy local copy of children when animation finishes
        this.setState({animating: true}, () => {
          SharedTimer.removeObserver(this.props.messageKey, this.timerID)
          this.timerID = SharedTimer.addObserver(() => this.setState({animating: false, children: null}), {
            key: this.props.messageKey,
            ms: animationDuration,
          })
        })
      }
      return
    }

    if (__STORYSHOT__) {
      // Storyshots with react 16.5 can't find the domNode and fails
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
    SharedTimer.removeObserver(this.props.messageKey, this.timerID)
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
            overflow: 'hidden',
            paddingRight: 28,
            position: 'relative',
          },
        ])}
      >
        {this.state.children}
        <Ashes
          doneExploding={!this.state.animating}
          exploded={this.props.retainHeight}
          explodedBy={this.props.explodedBy}
          height={this.state.height}
        />
      </Box>
    )
  }
}

const AshBox = glamorous.div({
  '&.full-width': {
    overflow: 'visible',
    transition: `width ${animationDuration}ms linear`,
    width: '100%',
  },
  backgroundColor: globalColors.white, // exploded messages don't have hover effects and we need to cover the message
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
})
const Ashes = (props: {doneExploding: boolean, exploded: boolean, explodedBy: ?string, height: number}) => {
  let explodedTag = null
  if (props.doneExploding) {
    explodedTag = props.explodedBy ? (
      <Text type="BodyTiny" style={styles.exploded}>
        EXPLODED BY{' '}
        <ConnectedUsernames
          type="BodySmallSemibold"
          onUsernameClicked="profile"
          usernames={[props.explodedBy]}
          inline={true}
          colorFollowing={true}
          colorYou={true}
          underline={true}
        />
      </Text>
    ) : (
      <Text type="BodyTiny" style={styles.exploded}>
        EXPLODED
      </Text>
    )
  }
  return (
    <AshBox className={props.exploded ? 'full-width' : undefined}>
      {props.exploded && explodedTag}
      <FlameFront height={props.height} stop={props.doneExploding} />
    </AshBox>
  )
}

const maxFlameWidth = 10
const flameOffset = 5
const FlameFront = (props: {height: number, stop: boolean}) => {
  if (props.stop) {
    return null
  }
  const numBoxes = Math.ceil(props.height / 15)
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

const colors = ['yellow', 'red', globalColors.grey, globalColors.black]
const randWidth = () => Math.round(Math.random() * maxFlameWidth) + flameOffset
const randColor = () => colors[Math.floor(Math.random() * colors.length)]

class Flame extends React.Component<{}, {color: string, timer: number, width: number}> {
  state = {color: randColor(), timer: 0, width: randWidth()}
  intervalID: ?IntervalID

  componentDidMount() {
    this.intervalID = setInterval(this._randomize, 100)
  }

  componentWillUnmount() {
    if (this.intervalID) {
      clearInterval(this.intervalID)
      this.intervalID = null
    }
  }

  _randomize = () =>
    this.setState(prevState => ({
      color: randColor(),
      timer: prevState.timer + 100,
      width: randWidth(),
    }))

  render() {
    return (
      <Box
        style={collapseStyles([
          {
            backgroundColor: this.state.color,
            width: this.state.width * (1 + this.state.timer / 1000),
          },
          styles.flame,
        ])}
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
  flame: {
    height: 17,
    marginBottom: 1,
    marginTop: 1,
    opacity: 1,
  },
  flameContainer: {
    position: 'absolute',
    right: -1 * (maxFlameWidth + flameOffset),
    width: maxFlameWidth + flameOffset,
  },
})

export default ExplodingHeightRetainer
