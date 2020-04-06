import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {resolveRootAsURL} from '../../../../../desktop/app/resolve-root.desktop'
import {urlsToImgSet} from '../../../../../common-adapters/icon.desktop'
import {Props} from '.'
import SharedTimer, {SharedTimerID} from '../../../../../util/shared-timers'

const copyChildren = (children: React.ReactNode): React.ReactNode =>
  // @ts-ignore
  React.Children.map(children, child => (child ? React.cloneElement(child) : child))

export const animationDuration = 2000

const retainedHeights = new Set<string>()

type State = {
  animating: boolean
  children?: React.ReactNode
  height: number
}

class ExplodingHeightRetainer extends React.PureComponent<Props, State> {
  _boxRef = React.createRef<HTMLDivElement>()
  state = {
    animating: false,
    children: this.props.retainHeight ? null : copyChildren(this.props.children), // no children if we already exploded
    height: 17,
  }
  timerID?: SharedTimerID

  static getDerivedStateFromProps(nextProps: Props, _: State) {
    return nextProps.retainHeight ? null : {children: copyChildren(nextProps.children)}
  }

  componentDidMount() {
    // remeasure if we are already exploded
    if (this.props.retainHeight && retainedHeights.has(this.props.messageKey) && this.props.measure) {
      retainedHeights.delete(this.props.messageKey)
      this.props.measure()
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.retainHeight) {
      if (!prevProps.retainHeight) {
        // destroy local copy of children when animation finishes
        this.setState({animating: true}, () => {
          this.timerID && SharedTimer.removeObserver(this.props.messageKey, this.timerID)
          this.timerID = SharedTimer.addObserver(() => this.setState({animating: false, children: null}), {
            key: this.props.messageKey,
            ms: animationDuration,
          })
        })
      }
      return
    }

    this.setHeight()
  }

  setHeight() {
    const node = this._boxRef.current
    if (node instanceof HTMLElement) {
      const height = node.clientHeight
      if (height && height !== this.state.height) {
        retainedHeights.add(this.props.messageKey)
        this.setState({height})
      }
    }
  }

  componentWillUnmount() {
    this.timerID && SharedTimer.removeObserver(this.props.messageKey, this.timerID)
  }

  render() {
    return (
      <Kb.Box
        style={Styles.collapseStyles([
          styles.container,
          this.props.style,
          // paddingRight is to compensate for the message menu
          // to make sure we don't rewrap text when showing the animation
          this.props.retainHeight && {
            height: this.state.height,
            paddingRight: 28,
            position: 'relative',
          },
        ])}
        forwardedRef={this._boxRef}
      >
        {this.state.children}
        <Ashes
          doneExploding={!this.state.animating}
          exploded={this.props.retainHeight}
          explodedBy={this.props.explodedBy}
          height={this.state.height}
        />
      </Kb.Box>
    )
  }
}

const Ashes = (props: {doneExploding: boolean; exploded: boolean; explodedBy?: string; height: number}) => {
  let explodedTag: React.ReactNode = null
  if (props.doneExploding) {
    explodedTag = props.explodedBy ? (
      <Kb.Text type="BodyTiny" style={styles.exploded}>
        EXPLODED BY{' '}
        <Kb.ConnectedUsernames
          type="BodySmallBold"
          onUsernameClicked="profile"
          usernames={props.explodedBy}
          inline={true}
          colorFollowing={true}
          colorYou={true}
          underline={true}
        />
      </Kb.Text>
    ) : (
      <Kb.Text type="BodyTiny" style={styles.exploded}>
        EXPLODED
      </Kb.Text>
    )
  }
  return (
    <AshBox className={Styles.classNames({'full-width': props.exploded})}>
      {props.exploded && explodedTag}
      <FlameFront height={props.height} stop={props.doneExploding} />
    </AshBox>
  )
}

const FlameFront = (props: {height: number; stop: boolean}) => {
  if (props.stop) {
    return null
  }
  const numBoxes = Math.max(Math.ceil(props.height / 17) - 1, 1)
  const children: Array<React.ReactNode> = []
  for (let i = 0; i < numBoxes; i++) {
    children.push(
      <Kb.Box style={styles.flame}>
        <Kb.Animation
          animationType={Styles.isDarkMode() ? 'darkExploding' : 'exploding'}
          width={64}
          height={64}
        />
      </Kb.Box>
    )
  }
  return (
    <Kb.Box className="flame-container" style={styles.flameContainer}>
      {children}
    </Kb.Box>
  )
}

const explodedIllustrationUrl = (): string =>
  Styles.isDarkMode()
    ? urlsToImgSet({'68': resolveRootAsURL('../images/icons/dark-pattern-ashes-desktop-400-68.png')}, 68)
    : urlsToImgSet({'68': resolveRootAsURL('../images/icons/pattern-ashes-desktop-400-68.png')}, 68)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      ashBox: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.white, // exploded messages don't have hover effects and we need to cover the message
          backgroundImage: explodedIllustrationUrl(),
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 68px',
          bottom: 0,
          left: 0,
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          transition: `width 0s`,
          width: 0,
        },
      }),
      container: {...Styles.globalStyles.flexBoxColumn, flex: 1},
      exploded: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.white,
          bottom: 0,
          color: Styles.globalColors.black_20_on_white,
          padding: 2,
          paddingLeft: Styles.globalMargins.tiny,
          paddingTop: 0,
          position: 'absolute',
          right: 0,
          whiteSpace: 'nowrap',
        },
      }),
      flame: {
        height: 17,
      },
      flameContainer: {
        position: 'absolute',
        right: -32,
        top: -22,
        width: 64,
      },
    } as const)
)

const AshBox = Styles.styled.div(
  {
    '&.full-width': {
      overflow: 'visible',
      transition: `width ${animationDuration}ms linear`,
      width: '100%',
    },
  },
  () => styles.ashBox
)

export default ExplodingHeightRetainer
