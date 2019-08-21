import * as React from 'react'
import {View} from 'react-native'
import {globalStyles, collapseStyles, globalMargins} from '../styles'
import {intersperseFn} from '../util/arrays'

import {Box2Props} from './box'

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

type Box2WithRefProps = Box2Props & {forwardedRef: React.Ref<View>}
const box2 = (props: Box2WithRefProps) => {
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
    props.alignSelf === 'center' && styles.alignSelfCenter,
    props.alignSelf === 'flex-start' && styles.alignSelfStart,
    props.alignSelf === 'flex-end' && styles.alignSelfEnd,
    props.alignItems === 'center' && styles.alignItemsCenter,
    props.alignItems === 'flex-end' && styles.alignItemsEnd,
    props.alignItems === 'flex-start' && styles.alignItemsStart,
    props.noShrink && styles.noShrink,
    // uncomment this to get debugging colors
    // {backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`},
    props.style,
  ])
  return (
    <View
      style={style}
      onLayout={props.onLayout}
      pointerEvents={props.pointerEvents || 'auto'}
      ref={props.forwardedRef}
      collapsable={props.collapsable}
    >
      {injectGaps(horizontal ? HBoxGap : VBoxGap, props.children, props.gap, props.gapStart, props.gapEnd)}
    </View>
  )
}

class Box2WithRef extends React.Component<Box2WithRefProps> {
  render() {
    return box2(this.props)
  }
}
const Box2 = React.forwardRef<View, Box2Props>((props, forwardedRef) => (
  <Box2WithRef {...props} forwardedRef={forwardedRef} />
))
const VBoxGap = ({gap}) => <View style={{flexShrink: 0, height: globalMargins[gap]}} />
const HBoxGap = ({gap}) => <View style={{flexShrink: 0, width: globalMargins[gap]}} />

const common = {
  alignItems: 'stretch',
  justifyContent: 'flex-start',
}
const styles = {
  alignItemsCenter: {alignItems: 'center'},
  alignItemsEnd: {alignItems: 'flex-end'},
  alignItemsStart: {alignItems: 'flex-start'},
  alignSelfCenter: {alignSelf: 'center'},
  alignSelfEnd: {alignSelf: 'flex-end'},
  alignSelfStart: {alignSelf: 'flex-start'},
  centered: {alignSelf: 'center'},
  centeredChildren: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullHeight: {height: '100%', maxHeight: '100%'},
  fullWidth: {maxWidth: '100%', width: '100%'},
  hbox: {
    ...globalStyles.flexBoxRow,
    ...common,
  },
  hrbox: {
    ...globalStyles.flexBoxRowReverse,
    ...common,
  },
  noShrink: {
    flexShrink: 0,
  },
  vbox: {
    ...globalStyles.flexBoxColumn,
    ...common,
  },
  vrbox: {
    ...globalStyles.flexBoxColumnReverse,
    ...common,
  },
}

export default Box
export {Box, Box2}
