import * as React from 'react'
import * as Kb from '@/common-adapters'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import throttle from 'lodash/throttle'
// ios must animated plain colors not the dynamic ones
import colors, {darkColors} from '@/styles/colors'
import type {Props} from '.'
import SharedTimer, {type SharedTimerID} from '@/util/shared-timers'

// If this image changes, some hard coded dimensions
// in this file also need to change.
const explodedIllustrationURL =
  require('../../../../../images/icons/pattern-ashes-mobile-400-80.png') as number
const explodedIllustrationDarkURL =
  require('../../../../../images/icons/dark-pattern-ashes-mobile-400-80.png') as number

export const animationDuration = 1500

const copyChildren = (children: React.ReactElement | Array<React.ReactElement>) =>
  React.Children.map(children, child => {
    return React.cloneElement(child)
  })

type State = {
  children: React.ReactElement | Array<React.ReactElement>
  height: number | undefined
  numImages: number
}

class ExplodingHeightRetainer extends React.Component<Props, State> {
  state = {
    children: this.props.retainHeight ? (
      <></>
    ) : this.props.children ? (
      copyChildren(this.props.children)
    ) : (
      <></>
    ),
    height: 20,
    numImages: 1,
  }
  timeoutID?: ReturnType<typeof setTimeout>

  static getDerivedStateFromProps(nextProps: Props, _: State) {
    return nextProps.retainHeight
      ? null
      : {children: nextProps.children ? copyChildren(nextProps.children) : <></>}
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.retainHeight && !prevProps.retainHeight && this.props.children) {
      // we just exploded! get rid of children when we're supposed to.
      this._clearTimeout()
      this.timeoutID = setTimeout(() => {
        this.setState({children: <></>})
        this.timeoutID = undefined
      }, animationDuration)
    }
  }

  componentWillUnmount() {
    this._clearTimeout()
  }

  _onLayout = (evt: Kb.LayoutEvent) => {
    if (evt.nativeEvent.layout.height !== this.state.height) {
      this.setState({
        height: evt.nativeEvent.layout.height,
        numImages: Math.ceil(evt.nativeEvent.layout.height / 80),
      })
    }
  }

  _clearTimeout = () => {
    // `if` is for clarity but isn't really necessary, `clearTimeout` fails silently
    if (this.timeoutID) {
      clearTimeout(this.timeoutID)
      this.timeoutID = undefined
    }
  }

  render() {
    return (
      <Kb.Box
        onLayout={this._onLayout}
        style={Kb.Styles.collapseStyles([
          styles.container,
          this.props.style,
          this.props.retainHeight && styles.retaining,
          !!this.state.height && this.props.retainHeight && {height: this.state.height},
        ])}
      >
        {this.state.children}
        <AnimatedAshTower
          exploded={this.props.retainHeight}
          explodedBy={this.props.explodedBy}
          messageKey={this.props.messageKey}
          numImages={this.state.numImages}
        />
      </Kb.Box>
    )
  }
}

type AshTowerProps = {
  exploded: boolean
  explodedBy?: string
  messageKey: string
  numImages: number
}

type AshTowerState = {
  showExploded: boolean
  width: NativeAnimated.Value
}

class AnimatedAshTower extends React.Component<AshTowerProps, AshTowerState> {
  state = {
    showExploded: this.props.exploded,
    width: this.props.exploded ? new NativeAnimated.Value(100) : new NativeAnimated.Value(0),
  }
  timerID?: SharedTimerID

  componentDidUpdate(prevProps: AshTowerProps) {
    if (!prevProps.exploded && this.props.exploded) {
      // just exploded! animate
      NativeAnimated.timing(this.state.width, {
        duration: animationDuration,
        easing: NativeEasing.inOut(NativeEasing.ease),
        toValue: 100,
        useNativeDriver: false,
      }).start()
      // insert 'EXPLODED' in sync with 'boom!' disappearing
      this.timerID && SharedTimer.removeObserver(this.props.messageKey, this.timerID)
      this.timerID = SharedTimer.addObserver(() => this.setState({showExploded: true}), {
        key: this.props.messageKey,
        ms: animationDuration,
      })
    }
  }

  componentWillUnmount() {
    this.timerID && SharedTimer.removeObserver(this.props.messageKey, this.timerID)
  }

  render() {
    if (!this.props.exploded) {
      return null
    }
    const width = this.state.width.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    })
    return (
      <NativeAnimated.View style={[{width}, styles.slider]}>
        <AshTower {...this.props} showExploded={this.state.showExploded} />
        <EmojiTower animatedValue={this.state.width} numImages={this.props.numImages} />
      </NativeAnimated.View>
    )
  }
}

class EmojiTower extends React.Component<
  {numImages: number; animatedValue: NativeAnimated.Value},
  {running: boolean}
> {
  state = {running: false}
  componentDidMount() {
    this.props.animatedValue.addListener(this._listener)
  }

  componentWillUnmount() {
    this._update.cancel()
    this.props.animatedValue.removeAllListeners()
  }

  _listener = (evt: {value: number}) => {
    if ([0, 100].includes(evt.value)) {
      this.setState({running: false})
      return
    }
    if (!this.state.running) {
      this.setState({running: true}, this._update)
      return
    }
    this._update()
  }

  _update = throttle(() => this.forceUpdate(), 100)

  render() {
    if (!this.state.running) {
      return null
    }
    const children: Array<React.ReactNode> = []
    for (let i = 0; i < this.props.numImages * 4; i++) {
      const r = Math.random()
      let emoji: string
      if (Kb.Styles.isAndroid) {
        emoji = r < 0.5 ? '💥' : '💣'
      } else {
        if (r < 0.33) {
          emoji = '💥'
        } else if (r < 0.66) {
          emoji = '💣'
        } else {
          emoji = '🤯'
        }
      }
      children.push(
        <Kb.Text key={i} type="Body" fixOverdraw={false}>
          {emoji}
        </Kb.Text>
      )
    }
    return <Kb.Box style={styles.emojiTower}>{children}</Kb.Box>
  }
}
const AshTower = (props: {explodedBy?: string; numImages: number; showExploded: boolean}) => {
  const children: Array<React.ReactNode> = []
  for (let i = 0; i < props.numImages; i++) {
    children.push(
      <Kb.Image2
        key={i}
        src={Kb.Styles.isDarkMode() ? explodedIllustrationDarkURL : explodedIllustrationURL}
        style={styles.ashes}
      />
    )
  }
  let exploded: React.ReactNode = null

  if (props.showExploded) {
    exploded = !props.explodedBy ? (
      <Kb.Text type="BodyTiny" style={styles.exploded} fixOverdraw={false}>
        EXPLODED
      </Kb.Text>
    ) : (
      <Kb.Text lineClamp={1} type="BodyTiny" style={styles.exploded} fixOverdraw={false}>
        EXPLODED BY{' '}
        <Kb.ConnectedUsernames
          type="BodySmallBold"
          fixOverdraw="auto"
          onUsernameClicked="profile"
          usernames={props.explodedBy}
          inline={true}
          colorFollowing={true}
          colorYou={true}
          underline={true}
        />
      </Kb.Text>
    )
  }
  return (
    <>
      {children}
      <Kb.Box style={styles.tagBox}>{exploded}</Kb.Box>
    </>
  )
}
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      ashes: {
        backgroundColor: Kb.Styles.globalColors.fastBlank,
        height: 80,
        width: 400,
      },
      container: {...Kb.Styles.globalStyles.flexBoxColumn, flex: 1},
      emojiTower: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        bottom: 0,
        overflow: 'hidden',
        position: 'absolute',
        right: 0,
        top: 0,
        width: 20,
      },
      exploded: {
        backgroundColor: Kb.Styles.globalColors.white,
        color: Kb.Styles.globalColors.black_20_on_white,
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      retaining: {
        overflow: 'hidden',
      },
      slider: {
        backgroundColor: Kb.Styles.isDarkMode() ? darkColors.white : colors.white,
        bottom: 0,
        height: '100%',
        left: 0,
        overflow: 'hidden',
        position: 'absolute',
        top: 0,
      },
      tagBox: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-end',
        backgroundColor: Kb.Styles.globalColors.fastBlank,
        bottom: 2,
        minWidth: 80,
        position: 'absolute',
        right: 0,
      },
    }) as const
)
export default ExplodingHeightRetainer
