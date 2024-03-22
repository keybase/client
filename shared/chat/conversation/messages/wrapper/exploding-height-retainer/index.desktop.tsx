import * as React from 'react'
import * as Kb from '@/common-adapters'
import {urlsToImgSet} from '@/common-adapters/icon.desktop'
import type {Props} from '.'
import SharedTimer, {type SharedTimerID} from '@/util/shared-timers'
import {getAssetPath} from '@/constants/platform.desktop'

const copyChildren = (children: React.ReactNode): React.ReactNode =>
  React.Children.map(children, child => (child ? React.cloneElement(child as any) : child))

export const animationDuration = 2000

const retainedHeights = new Set<string>()

type State = {
  animating: boolean
  children?: React.ReactNode
  height: number
}

class ExplodingHeightRetainer extends React.PureComponent<Props, State> {
  _boxRef = React.createRef<Kb.MeasureRef>()
  state = {
    animating: false,
    children: this.props.retainHeight ? null : copyChildren(this.props.children), // no children if we already exploded
    height: 17,
  }
  timerID?: SharedTimerID

  static getDerivedStateFromProps(nextProps: Props, _: State) {
    return nextProps.retainHeight ? null : {children: copyChildren(nextProps.children)}
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

  private setHeight() {
    const measure = this._boxRef.current?.measure
    if (!measure) return

    const m = measure()
    if (!m) return

    const {height} = m
    if (height && height !== this.state.height) {
      retainedHeights.add(this.props.messageKey)
      this.setState({height})
    }
  }

  componentWillUnmount() {
    this.timerID && SharedTimer.removeObserver(this.props.messageKey, this.timerID)
  }

  private _setBoxRef = (r: null | Kb.MeasureRef) => {
    this._boxRef = {current: r}
    this.setHeight()
  }

  render() {
    return (
      <Kb.Box2Measure
        direction="vertical"
        style={Kb.Styles.collapseStyles([
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
        ref={this._setBoxRef}
      >
        {this.state.children}
        <Ashes
          doneExploding={!this.state.animating}
          exploded={this.props.retainHeight}
          explodedBy={this.props.explodedBy}
          height={this.state.height}
        />
      </Kb.Box2Measure>
    )
  }
}

const Ashes = (props: {doneExploding: boolean; exploded: boolean; explodedBy?: string; height: number}) => {
  const {doneExploding, explodedBy, exploded, height} = props
  let explodedTag: React.ReactNode = null
  if (doneExploding) {
    explodedTag = explodedBy ? (
      <Kb.Text type="BodyTiny" style={styles.exploded}>
        <Kb.Text type="BodyTiny" virtualText={true}>
          {'EXPLODED BY '}
        </Kb.Text>
        <Kb.ConnectedUsernames
          type="BodySmallBold"
          onUsernameClicked="profile"
          usernames={explodedBy}
          inline={true}
          colorFollowing={true}
          colorYou={true}
          underline={true}
          virtualText={true}
        />
      </Kb.Text>
    ) : (
      <Kb.Text type="BodyTiny" style={styles.exploded} virtualText={true}>
        EXPLODED
      </Kb.Text>
    )
  }

  return (
    <div
      className={Kb.Styles.classNames('ashbox', {'full-width': exploded})}
      style={Kb.Styles.castStyleDesktop(styles.ashBox)}
    >
      {exploded && explodedTag}
      <FlameFront height={height} stop={doneExploding} />
    </div>
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
      <Kb.Box key={String(i)} style={styles.flame}>
        <Kb.Animation
          animationType={Kb.Styles.isDarkMode() ? 'darkExploding' : 'exploding'}
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

const explodedIllustrationUrl = () =>
  Kb.Styles.isDarkMode()
    ? urlsToImgSet({'68': getAssetPath('images', 'icons', 'dark-pattern-ashes-desktop-400-68.png')}, 68)
    : urlsToImgSet({'68': getAssetPath('images', 'icons', 'pattern-ashes-desktop-400-68.png')}, 68)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      ashBox: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white, // exploded messages don't have hover effects and we need to cover the message
          backgroundImage: explodedIllustrationUrl() ?? undefined,
          backgroundRepeat: 'repeat',
          backgroundSize: '400px 68px',
          bottom: 0,
          left: 0,
          position: 'absolute',
          top: 0,
        },
      }),
      container: {...Kb.Styles.globalStyles.flexBoxColumn, flex: 1},
      exploded: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          bottom: 0,
          color: Kb.Styles.globalColors.black_20_on_white,
          padding: 2,
          paddingLeft: Kb.Styles.globalMargins.tiny,
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
    }) as const
)

export default ExplodingHeightRetainer
