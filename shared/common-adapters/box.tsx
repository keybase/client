import type * as React from 'react'
import * as Styles from '@/styles'
import {View} from 'react-native'
import Reanimated from 'react-native-reanimated'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type {Box2Props} from '@/common-adapters/box.shared'
export type {LayoutEvent} from '@/common-adapters/box.shared'
import './box.css'

type Margins = keyof typeof Styles.globalMargins
const marginKeys = Object.keys(Styles.globalMargins) as Array<Margins>

const hgapStyles = new Map(marginKeys.map(gap => [gap, {columnGap: Styles.globalMargins[gap]}]))
const vgapStyles = new Map(marginKeys.map(gap => [gap, {rowGap: Styles.globalMargins[gap]}]))
const hgapStartStyles = new Map(marginKeys.map(gap => [gap, {paddingLeft: Styles.globalMargins[gap]}]))
const vgapStartStyles = new Map(marginKeys.map(gap => [gap, {paddingTop: Styles.globalMargins[gap]}]))
const hgapEndStyles = new Map(marginKeys.map(gap => [gap, {paddingRight: Styles.globalMargins[gap]}]))
const vgapEndStyles = new Map(marginKeys.map(gap => [gap, {paddingBottom: Styles.globalMargins[gap]}]))
const paddingStyles = new Map(marginKeys.map(p => [p, {padding: Styles.globalMargins[p]}]))

const box2SharedProps = (p: Box2Props) => {
  const {direction, fullHeight, fullWidth, centerChildren, alignSelf, alignItems, noShrink} = p
  const {flex, justifyContent, overflow, padding, relative} = p
  const {collapsable = true, onLayout, pointerEvents, children, gap, gapStart, gapEnd} = p
  const {style: _style} = p
  const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'
  let directionStyle: Styles.StylesCrossPlatform
  switch (direction) {
    case 'horizontal':
      directionStyle = nativeStyles.hbox
      break
    case 'horizontalReverse':
      directionStyle = nativeStyles.hrbox
      break
    case 'verticalReverse':
      directionStyle = nativeStyles.vrbox
      break
    case 'vertical':
    default:
      directionStyle = nativeStyles.vbox
      break
  }
  let alignSelfStyle: Styles.StylesCrossPlatform = null
  switch (alignSelf) {
    case 'center':
      alignSelfStyle = nativeStyles.alignSelfCenter
      break
    case 'flex-start':
      alignSelfStyle = nativeStyles.alignSelfStart
      break
    case 'flex-end':
      alignSelfStyle = nativeStyles.alignSelfEnd
      break
    case 'stretch':
      alignSelfStyle = nativeStyles.alignSelfStretch
      break
    default:
  }
  let alignItemsStyle: Styles.StylesCrossPlatform = null
  switch (alignItems) {
    case 'center':
      alignItemsStyle = nativeStyles.alignItemsCenter
      break
    case 'flex-start':
      alignItemsStyle = nativeStyles.alignItemsStart
      break
    case 'flex-end':
      alignItemsStyle = nativeStyles.alignItemsEnd
      break
    case 'stretch':
      alignItemsStyle = nativeStyles.alignItemsStretch
      break
    default:
  }
  let justifyContentStyle: Styles.StylesCrossPlatform = null
  switch (justifyContent) {
    case 'center':
      justifyContentStyle = nativeStyles.justifyContentCenter
      break
    case 'flex-start':
      justifyContentStyle = nativeStyles.justifyContentStart
      break
    case 'flex-end':
      justifyContentStyle = nativeStyles.justifyContentEnd
      break
    case 'space-between':
      justifyContentStyle = nativeStyles.justifyContentBetween
      break
    case 'space-around':
      justifyContentStyle = nativeStyles.justifyContentAround
      break
    case 'space-evenly':
      justifyContentStyle = nativeStyles.justifyContentEvenly
      break
    default:
  }
  let overflowStyle: Styles.StylesCrossPlatform = null
  switch (overflow) {
    case 'hidden':
      overflowStyle = nativeStyles.overflowHidden
      break
    case 'visible':
      overflowStyle = nativeStyles.overflowVisible
      break
    default:
  }

  const style = Styles.collapseStyles([
    directionStyle,
    fullHeight && nativeStyles.fullHeight,
    fullWidth && nativeStyles.fullWidth,
    !fullHeight && !fullWidth && nativeStyles.centered,
    centerChildren && nativeStyles.centeredChildren,
    alignSelfStyle,
    alignItemsStyle,
    justifyContentStyle,
    noShrink && nativeStyles.noShrink,
    flex != null && (flex === 1 ? nativeStyles.flex1 : {flex}),
    relative && nativeStyles.relative,
    overflowStyle,
    padding && paddingStyles.get(padding),
    gap && horizontal && hgapStyles.get(gap),
    gap && !horizontal && vgapStyles.get(gap),
    gap && gapStart && horizontal && hgapStartStyles.get(gap),
    gap && gapStart && !horizontal && vgapStartStyles.get(gap),
    gap && gapEnd && horizontal && hgapEndStyles.get(gap),
    gap && gapEnd && !horizontal && vgapEndStyles.get(gap),
    _style,
  ])

  return {
    children,
    collapsable,
    onLayout,
    pointerEvents,
    style,
  }
}

export const Box2 = (p: Box2Props & {ref?: React.Ref<MeasureRef>}) => {
  if (!isMobile) {
    const {direction, fullHeight, fullWidth, centerChildren, alignSelf, alignItems, noShrink, ref} = p
    const {flex, justifyContent, overflow, padding, relative} = p
    const {onMouseMove, onMouseDown, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture, children} = p
    const {onContextMenu, gap, gapStart, gapEnd, pointerEvents, onDragLeave, onDragOver, onDrop} = p
    const {style: _style, className: _className, title, tooltip} = p
    const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'
    const reverse = direction === 'verticalReverse' || direction === 'horizontalReverse'

    const style = Styles.collapseStyles([
      flex != null && flex !== 1 ? {flex} : undefined,
      _style,
    ]) as unknown as React.CSSProperties

    const className = Styles.classNames(
      {
        [`box2_alignItems_${alignItems ?? ''}`]: alignItems,
        [`box2_alignSelf_${alignSelf ?? ''}`]: alignSelf,
        [`box2_gapEnd_${gap ?? ''}`]: gapEnd,
        [`box2_gapStart_${gap ?? ''}`]: gapStart,
        [`box2_gap_${gap ?? ''}`]: gap,
        [`box2_justifyContent_${justifyContent ?? ''}`]: justifyContent,
        [`box2_overflow_${overflow ?? ''}`]: overflow,
        [`box2_padding_${padding ?? ''}`]: padding,
        box2_centered: !fullHeight && !fullWidth,
        box2_centeredChildren: centerChildren,
        box2_flex1: flex === 1,
        box2_fullHeight: fullHeight,
        box2_fullWidth: fullWidth,
        box2_horizontal: horizontal,
        box2_no_shrink: noShrink,
        box2_pointerEvents_none: pointerEvents === 'none',
        box2_relative: relative,
        box2_reverse: reverse,
        box2_vertical: !horizontal,
        tooltip,
      },
      _className
    )

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={className}
        data-tooltip={tooltip}
        onContextMenu={onContextMenu}
        onCopyCapture={onCopyCapture}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        onMouseOver={onMouseOver}
        onMouseUp={onMouseUp}
        style={style}
        title={title}
        children={children}
      />
    )
  }

  const {ref, ...rest} = p
  const props = box2SharedProps(rest)
  return <View {...props} ref={ref as React.Ref<View>} />
}

export const Box2Animated = (p: Box2Props & {ref?: React.Ref<MeasureRef>}) => {
  if (!isMobile) return <Box2 {...p} />
  const {ref, ...rest} = p
  const props = box2SharedProps(rest)
  return <Reanimated.View {...props} ref={ref as React.Ref<View>} />
}

const common = {
  alignItems: 'stretch',
  justifyContent: 'flex-start',
} as const

const nativeStyles = {
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
  flex1: {flex: 1},
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
  justifyContentAround: {justifyContent: 'space-around'},
  justifyContentBetween: {justifyContent: 'space-between'},
  justifyContentCenter: {justifyContent: 'center'},
  justifyContentEnd: {justifyContent: 'flex-end'},
  justifyContentEvenly: {justifyContent: 'space-evenly'},
  justifyContentStart: {justifyContent: 'flex-start'},
  noShrink: {
    flexShrink: 0,
  },
  overflowHidden: {overflow: 'hidden'},
  overflowVisible: {overflow: 'visible'},
  relative: {position: 'relative'},
  vbox: {
    ...Styles.globalStyles.flexBoxColumn,
    ...common,
  },
  vrbox: {
    ...Styles.globalStyles.flexBoxColumnReverse,
    ...common,
  },
} as const
