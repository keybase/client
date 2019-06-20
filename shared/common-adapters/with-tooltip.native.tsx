import * as React from 'react'
import {Dimensions, View} from 'react-native'
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
  _1: never,
  _2: never,
  width: number,
  height: number,
  left: number,
  top: number
) => resolve({height, left, top, width})

class WithTooltip extends React.PureComponent<PropsWithTimer<Props>, State> {
  state = {
    left: 0,
    top: 0,
    visible: false,
  }
  _clickableRef = React.createRef<View>()
  _tooltipRef = React.createRef<View>()
  _onClick = () => {
    if (!this._clickableRef.current || !this._tooltipRef.current || this.state.visible) {
      return
    }

    const screenWidth = Dimensions.get('window').width
    const screenHeight = Dimensions.get('window').height

    Promise.all([
      new Promise(
        resolve => this._clickableRef.current && this._clickableRef.current.measure(measureCb(resolve))
      ),
      new Promise(
        resolve => this._tooltipRef.current && this._tooltipRef.current.measure(measureCb(resolve))
      ),
    ]).then(([c, t]: [Dims, Dims]) => {
      if (!this._mounted) {
        return
      }

      const constrainLeft = ideal => Math.max(0, Math.min(ideal, screenWidth - t.width))
      const constrainTop = ideal => Math.max(0, Math.min(ideal, screenHeight - t.height))
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
      return <View style={this.props.containerStyle}>{this.props.children}</View>
    }

    return (
      <>
        <View style={this.props.containerStyle} ref={this._clickableRef} className={this.props.className}>
          <Kb.ClickableBox onClick={this._onClick}>{this.props.children}</Kb.ClickableBox>
        </View>
        <Kb.Animated from={{}} to={{opacity: this.state.visible ? 1 : 0}}>
          {animatedStyle => (
            <Kb.FloatingBox>
              <View
                pointerEvents="none"
                style={Styles.collapseStyles([Styles.globalStyles.flexBoxRow, {top: this.state.top}])}
              >
                <View
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
                </View>
              </View>
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
