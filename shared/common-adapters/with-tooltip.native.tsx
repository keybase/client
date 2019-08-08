import * as React from 'react'
import {NativeDimensions, NativeView} from './native-wrappers.native'
import FloatingBox from './floating-box'
import hOCTimers, {PropsWithTimer} from './hoc-timers'
import ClickableBox from './clickable-box'
import Text from './text'
import Animated from './animated'
import * as Styles from '../styles'
import {Props} from './with-tooltip'

// This uses a similar mechanism to relative-popup-hoc.desktop.js. It's only
// ever used for tooltips on mobile for now. If we end up needing relative
// positioning in other places, we should probably make a
// relative-popup-hoc.native.js. Also, this only supports "bottom center" and
// "top center" for now.

const Kb = {
  Animated,
  ClickableBox,
  FloatingBox,
  NativeDimensions,
  NativeView,
  Text,
}

type State = {
  left: number
  top: number
  visible: boolean
}

type Dims = {
  height: number
  left: number
  top: number
  width: number
}
const measureCb = (resolve: (dims: Dims) => void) => (
  _x: number,
  _y: number,
  width: number,
  height: number,
  pageX: number,
  pageY: number
) => resolve({height, left: pageX, top: pageY, width})

class WithTooltip extends React.PureComponent<PropsWithTimer<Props>, State> {
  state = {
    left: 0,
    top: 0,
    visible: false,
  }
  _clickableRef = React.createRef<NativeView>()
  _tooltipRef = React.createRef<NativeView>()
  _onClick = () => {
    if (!this._clickableRef.current || !this._tooltipRef.current || this.state.visible) {
      return
    }

    const screenWidth = Kb.NativeDimensions.get('window').width
    const screenHeight = Kb.NativeDimensions.get('window').height

    Promise.all([
      new Promise(
        resolve => this._clickableRef.current && this._clickableRef.current.measure(measureCb(resolve))
      ),
      new Promise(
        resolve => this._tooltipRef.current && this._tooltipRef.current.measure(measureCb(resolve))
      ),
      // @ts-ignore this stucture makes this very hard to type
    ]).then(([c, t]: [Dims, Dims]) => {
      if (!this._mounted) {
        return
      }

      const constrainLeft = (ideal: number) => Math.max(0, Math.min(ideal, screenWidth - t.width))
      const constrainTop = (ideal: number) => Math.max(0, Math.min(ideal, screenHeight - t.height))
      this.props.position === 'bottom center'
        ? this.setState({
            left: constrainLeft(c.left + c.width / 2 - t.width / 2),
            top: constrainTop(c.top + c.height),
            visible: true,
          })
        : this.setState({
            left: constrainLeft(c.left + c.width / 2 - t.width / 2),
            top: constrainTop(c.top - t.height),
            visible: true,
          }) // default to top center

      this.props.setTimeout(() => {
        this._mounted && this.setState({visible: false})
      }, 3000)
    })
  }

  _mounted = false
  componentDidMount() {
    this._mounted = true
  }
  componentWillUnmount() {
    this._mounted = false
  }

  render() {
    if (!this.props.showOnPressMobile || this.props.disabled) {
      return <Kb.NativeView style={this.props.containerStyle as any}>{this.props.children}</Kb.NativeView>
    }

    return (
      <>
        <Kb.NativeView style={this.props.containerStyle as any} ref={this._clickableRef}>
          <Kb.ClickableBox onClick={this._onClick}>{this.props.children}</Kb.ClickableBox>
        </Kb.NativeView>
        <Kb.Animated from={{}} to={{opacity: this.state.visible ? 1 : 0}}>
          {animatedStyle => (
            <Kb.FloatingBox>
              <Kb.NativeView
                pointerEvents="none"
                style={Styles.collapseStyles([Styles.globalStyles.flexBoxRow, {top: this.state.top}])}
              >
                <Kb.NativeView
                  style={Styles.collapseStyles([animatedStyle, styles.container, {left: this.state.left}])}
                  ref={this._tooltipRef}
                >
                  <Kb.Text
                    center={!this.props.multiline}
                    type="BodySmall"
                    style={Styles.collapseStyles([styles.text, this.props.textStyle])}
                    lineClamp={this.props.multiline ? undefined : 1}
                  >
                    {this.props.text}
                  </Kb.Text>
                </Kb.NativeView>
              </Kb.NativeView>
            </Kb.FloatingBox>
          )}
        </Kb.Animated>
      </>
    )
  }
}
export default hOCTimers(WithTooltip)

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.black_60,
    borderRadius: Styles.borderRadius,
    maxWidth: 280,
    padding: Styles.globalMargins.xtiny,
  },
  text: {
    color: Styles.globalColors.white,
  },
})
