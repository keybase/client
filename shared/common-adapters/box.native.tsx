import * as React from 'react'
import * as Styles from '../styles'
import {View} from 'react-native'
import type {Box2Props} from './box'

const Box = View

type Margins = keyof typeof Styles.globalMargins
const marginKeys: Array<Margins> = Object.keys(Styles.globalMargins) as any

const hgapStyles = new Map(marginKeys.map(gap => [gap, {columnGap: Styles.globalMargins[gap]}]))
const vgapStyles = new Map(marginKeys.map(gap => [gap, {rowGap: Styles.globalMargins[gap]}]))
const hgapStartStyles = new Map(marginKeys.map(gap => [gap, {paddingLeft: Styles.globalMargins[gap]}]))
const vgapStartStyles = new Map(marginKeys.map(gap => [gap, {paddingTop: Styles.globalMargins[gap]}]))
const hgapEndStyles = new Map(marginKeys.map(gap => [gap, {paddingRight: Styles.globalMargins[gap]}]))
const vgapEndStyles = new Map(marginKeys.map(gap => [gap, {paddingBottom: Styles.globalMargins[gap]}]))

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
        gap && horizontal && hgapStyles.get(gap),
        gap && !horizontal && vgapStyles.get(gap),
        gap && gapStart && horizontal && hgapStartStyles.get(gap),
        gap && gapStart && !horizontal && vgapStartStyles.get(gap),
        gap && gapEnd && horizontal && hgapEndStyles.get(gap),
        gap && gapEnd && !horizontal && vgapEndStyles.get(gap),
        // uncomment this to get debugging colors
        // {backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`},
        style,
      ])}
      onLayout={onLayout}
      pointerEvents={pointerEvents}
    >
      {children}
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
