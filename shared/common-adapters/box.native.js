// @flow
import * as React from 'react'
import {View} from 'react-native'
import {globalStyles, collapseStyles, globalMargins, type StylesCrossPlatform} from '../styles'
import {intersperseFn} from '../util/arrays'

type Box2Props = {
  children?: React.Node,
  direction: 'horizontal' | 'vertical',
  fullHeight?: boolean,
  fullWidth?: boolean,
  style?: StylesCrossPlatform,
  gap?: $Keys<typeof globalMargins>,
  gapStart?: boolean,
  gapEnd?: boolean,
}

const Box = View

const injectGaps = (Component, _children, gap, gapStart, gapEnd) => {
  let children = _children
  if (gap) {
    children = intersperseFn(index => <Component key={index} gap={gap} />, React.Children.toArray(_children))
    if (gapStart) {
      children.unshift(<Component key="gapStart" gap={gap} />)
    }
    if (gapEnd) {
      children.push(<Component key="gapEnd" gap={gap} />)
    }
  }

  return children
}

class Box2 extends React.Component<Box2Props> {
  render() {
    const horizontal = this.props.direction === 'horizontal'
    const style = collapseStyles([
      horizontal ? styles.hbox : styles.vbox,
      this.props.fullHeight && styles.fullHeight,
      this.props.fullWidth && styles.fullWidth,
      !this.props.fullHeight && !this.props.fullWidth && styles.centered,
      // uncomment this to get debugging colors
      // {backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`},
      this.props.style,
    ])
    return (
      <View style={style}>
        {injectGaps(
          horizontal ? HBoxGap : VBoxGap,
          this.props.children,
          this.props.gap,
          this.props.gapStart,
          this.props.gapEnd
        )}
      </View>
    )
  }
}
const VBoxGap = ({gap}) => <View style={{height: globalMargins[gap]}} />
const HBoxGap = ({gap}) => <View style={{width: globalMargins[gap]}} />

const styles = {
  centered: {alignSelf: 'center'},
  fullHeight: {height: '100%'},
  fullWidth: {width: '100%'},
  hbox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  vbox: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
}

export default Box
export {Box, Box2}
