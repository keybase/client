// @flow
import * as React from 'react'
import {View} from 'react-native'
import {globalStyles, collapseStyles, globalMargins} from '../styles'
import {intersperseFn} from '../util/arrays'

import type {Box2Props} from './box'

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

const box2 = (props: Box2Props) => {
  let horizontal = props.direction === 'horizontal' || props.direction === 'horizontalReverse'
  let directionStyle
  switch (props.direction) {
    case 'horizontal':
      directionStyle = styles.hbox
      break
    case 'horizontalReverse':
      directionStyle = styles.hrbox
      break
    case 'verticalReverse':
      directionStyle = styles.vrbox
      break
    case 'vertical':
    default:
      directionStyle = styles.vbox
      break
  }

  const style = collapseStyles([
    directionStyle,
    props.fullHeight && styles.fullHeight,
    props.fullWidth && styles.fullWidth,
    !props.fullHeight && !props.fullWidth && styles.centered,
    props.centerChildren && styles.centeredChildren,
    // uncomment this to get debugging colors
    // {backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`},
    props.style,
  ])
  return (
    <View style={style} onLayout={props.onLayout}>
      {injectGaps(horizontal ? HBoxGap : VBoxGap, props.children, props.gap, props.gapStart, props.gapEnd)}
    </View>
  )
}

class Box2 extends React.Component<Box2Props> {
  render() {
    return box2(this.props)
  }
}
const VBoxGap = ({gap}) => <View style={{height: globalMargins[gap]}} />
const HBoxGap = ({gap}) => <View style={{width: globalMargins[gap]}} />

const styles = {
  centered: {alignSelf: 'center'},
  centeredChildren: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullHeight: {height: '100%', maxHeight: '100%'},
  fullWidth: {width: '100%', maxWidth: '100%'},
  vbox: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  vrbox: {
    ...globalStyles.flexBoxColumnReverse,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  hbox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  hrbox: {
    ...globalStyles.flexBoxRowReverse,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
}

export default Box
export {Box, Box2}
