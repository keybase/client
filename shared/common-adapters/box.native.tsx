import * as React from 'react'
import * as Styles from '../styles'
import {View} from 'react-native'
import {intersperseFn} from '../util/arrays'
import type {Box2Props} from './box'

const Box = View

type Margins = keyof typeof Styles.globalMargins
const marginKeys: Array<Margins> = Object.keys(Styles.globalMargins) as any

const hgapStyles = new Map(marginKeys.map(gap => [gap, {flexShrink: 0, width: Styles.globalMargins[gap]}]))
const vgapStyles = new Map(marginKeys.map(gap => [gap, {flexShrink: 0, height: Styles.globalMargins[gap]}]))

// premake the gaps and cache them forever so we can take advantage of react optimizing them if they're the same
const vgaps = new Map(
  marginKeys.map(gap => [
    gap,
    new Array(100).fill('').map((_, idx) => <View key={'vgap-' + idx} style={vgapStyles.get(gap)} />),
  ])
)
const hgaps = new Map(
  marginKeys.map(gap => [
    gap,
    new Array(100).fill('').map((_, idx) => <View key={'hgap-' + idx} style={hgapStyles.get(gap)} />),
  ])
)

const Box2 = React.forwardRef(function Box2Inner(props: Box2Props, ref: React.Ref<View>) {
  const {direction, fullHeight, fullWidth, centerChildren, alignSelf, alignItems, noShrink} = props
  const {collapsable = true} = props
  const {style, onLayout, pointerEvents, children, gap, gapStart, gapEnd} = props
  const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'
  let directionStyle: Styles.StylesCrossPlatform
  switch (direction) {
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
  let alignSelfStyle: Styles.StylesCrossPlatform = null
  switch (alignSelf) {
    case 'center':
      alignSelfStyle = styles.alignSelfCenter
      break
    case 'flex-start':
      alignSelfStyle = styles.alignSelfStart
      break
    case 'flex-end':
      alignSelfStyle = styles.alignSelfEnd
      break
    case 'stretch':
      alignSelfStyle = styles.alignSelfStretch
  }
  let alignItemsStyle: Styles.StylesCrossPlatform = null
  switch (alignItems) {
    case 'center':
      alignItemsStyle = styles.alignItemsCenter
      break
    case 'flex-start':
      alignItemsStyle = styles.alignItemsStart
      break
    case 'flex-end':
      alignItemsStyle = styles.alignItemsEnd
      break
    case 'stretch':
      alignItemsStyle = styles.alignItemsStretch
      break
  }

  let gappedChildren: Array<React.ReactNode> = children as any
  if (gap && (gapStart || gapEnd || React.Children.count(children) > 1)) {
    let gapIdx = 1
    const gapList = horizontal ? hgaps.get(gap)! : vgaps.get(gap)!
    gappedChildren = intersperseFn(() => gapList[gapIdx++], React.Children.toArray(gappedChildren))
    if (gapStart) {
      gappedChildren.unshift(gapList[0])
    }
    if (gapEnd) {
      gappedChildren.push(gapList[gapIdx])
    }
  }

  return (
    <View
      ref={ref}
      collapsable={collapsable}
      style={Styles.collapseStyles([
        directionStyle,
        fullHeight && styles.fullHeight,
        fullWidth && styles.fullWidth,
        !fullHeight && !fullWidth && styles.centered,
        centerChildren && styles.centeredChildren,
        alignSelfStyle,
        alignItemsStyle,
        noShrink && styles.noShrink,
        // uncomment this to get debugging colors
        // {backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`},
        style,
      ])}
      onLayout={onLayout}
      pointerEvents={pointerEvents}
    >
      {gappedChildren}
    </View>
  )
})

const common = {
  alignItems: 'stretch',
  justifyContent: 'flex-start',
} as const

const styles = {
  alignItemsCenter: {alignItems: 'center'},
  alignItemsEnd: {alignItems: 'flex-end'},
  alignItemsStart: {alignItems: 'flex-start'},
  alignItemsStretch: {alignItems: 'stretch'},
  alignSelfCenter: {alignSelf: 'center'},
  alignSelfEnd: {alignSelf: 'flex-end'},
  alignSelfStart: {alignSelf: 'flex-start'},
  alignSelfStretch: {alignSelf: 'stretch'},
  centered: {alignSelf: 'center'},
  centeredChildren: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullHeight: {height: '100%', maxHeight: '100%'},
  fullWidth: {maxWidth: '100%', width: '100%'},
  hbox: {
    ...Styles.globalStyles.flexBoxRow,
    ...common,
  },
  hrbox: {
    ...Styles.globalStyles.flexBoxRowReverse,
    ...common,
  },
  noShrink: {
    flexShrink: 0,
  },
  vbox: {
    ...Styles.globalStyles.flexBoxColumn,
    ...common,
  },
  vrbox: {
    ...Styles.globalStyles.flexBoxColumnReverse,
    ...common,
  },
} as const

export default Box
export {Box, Box2}
