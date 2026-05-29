import * as React from 'react'
import * as Styles from '@/styles'
import {Pressable, View} from 'react-native'
import type {MeasureRef} from '@/common-adapters/measure-ref'
import type {NativeSyntheticEvent} from 'react-native'
import './box.css'

export type Box2Props = {
  alignItems?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  alignSelf?: 'center' | 'flex-start' | 'flex-end' | 'stretch'
  children?: React.ReactNode
  centerChildren?: boolean
  className?: string
  collapsable?: boolean
  direction: 'horizontal' | 'vertical' | 'horizontalReverse' | 'verticalReverse'
  flex?: number
  fullHeight?: boolean
  fullWidth?: boolean
  justifyContent?: 'center' | 'flex-start' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
  noShrink?: boolean
  overflow?: 'hidden' | 'scroll' | 'visible' | 'auto'
  onDragLeave?: (syntheticDragEvent: React.DragEvent) => void
  onDragOver?: (syntheticDragEvent: React.DragEvent) => void
  onDrop?: (syntheticDragEvent: React.DragEvent) => void
  onLayout?: (evt: LayoutEvent) => void
  onMouseDown?: (syntheticEvent: React.MouseEvent) => void
  onMouseMove?: (syntheticEvent: React.MouseEvent) => void
  onMouseLeave?: (syntheticEvent: React.MouseEvent) => void
  onMouseUp?: (syntheticEvent: React.MouseEvent) => void
  onMouseOver?: (syntheticEvent: React.MouseEvent) => void
  onCopyCapture?: (syntheticEvent: React.SyntheticEvent) => void
  onContextMenu?: () => void
  padding?: keyof typeof Styles.globalMargins
  pointerEvents?: 'none' | 'box-none'
  relative?: boolean
  style?: Styles.StylesCrossPlatform
  gap?: keyof typeof Styles.globalMargins
  gapStart?: boolean
  gapEnd?: boolean
  testID?: string
  title?: string
  tooltip?: string
}

export type LayoutEvent = NativeSyntheticEvent<{
  layout: {
    x: number
    y: number
    width: number
    height: number
  }
}>

export type {MeasureRef} from './measure-ref'

type Margins = keyof typeof Styles.globalMargins
const marginKeys = Object.keys(Styles.globalMargins) as Array<Margins>

const hgapStyles = new Map(marginKeys.map(gap => [gap, {columnGap: Styles.globalMargins[gap]}]))
const vgapStyles = new Map(marginKeys.map(gap => [gap, {rowGap: Styles.globalMargins[gap]}]))
const hgapStartStyles = new Map(marginKeys.map(gap => [gap, {paddingLeft: Styles.globalMargins[gap]}]))
const vgapStartStyles = new Map(marginKeys.map(gap => [gap, {paddingTop: Styles.globalMargins[gap]}]))
const hgapEndStyles = new Map(marginKeys.map(gap => [gap, {paddingRight: Styles.globalMargins[gap]}]))
const vgapEndStyles = new Map(marginKeys.map(gap => [gap, {paddingBottom: Styles.globalMargins[gap]}]))
const paddingStyles = new Map(marginKeys.map(p => [p, {padding: Styles.globalMargins[p]}]))

export const box2SharedProps = (p: Box2Props) => {
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

// Shared className generator used by Box2 and ClickableBox3.
export const box2ClassNames = (p: Box2Props, extra?: string): string => {
  const {direction, alignItems, alignSelf, gap, gapStart, gapEnd, justifyContent, overflow} = p
  const {padding, centerChildren, flex, fullHeight, fullWidth, noShrink, pointerEvents, relative, tooltip, className} = p
  const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'
  const reverse = direction === 'verticalReverse' || direction === 'horizontalReverse'
  return Styles.classNames(
    extra,
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
    className
  )
}

export const Box2 = (p: Box2Props & {ref?: React.Ref<MeasureRef>}) => {
  if (!isMobile) {
    const {ref} = p
    const {onMouseMove, onMouseDown, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture, children, testID} = p
    const {onContextMenu, flex, onDragLeave, onDragOver, onDrop} = p
    const {style: _style, title, tooltip} = p

    const style = Styles.collapseStyles([
      flex != null && flex !== 1 ? {flex} : undefined,
      _style,
    ]) as unknown as React.CSSProperties

    const className = box2ClassNames(p)

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={className}
        data-tooltip={tooltip}
        data-testid={testID}
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

  const {ref, testID, ...rest} = p
  const props = box2SharedProps(rest)
  return <View {...props} testID={testID} ref={ref as React.Ref<View>} />
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
  centeredChildren: Styles.centered(),
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

export type ClickableBox3Props = Box2Props & {
  onClick?: () => void
  onLongPress?: () => void
  hitSlop?: number
}

export const ClickableBox3 = (p: ClickableBox3Props & {ref?: React.Ref<MeasureRef | null>}) => {
  const {onClick, onLongPress, hitSlop, ref, ...box2p} = p

  if (!isMobile) {
    const {children, style: _style, onMouseOver, testID, flex} = box2p
    const cn = box2ClassNames(box2p, 'clickable-box2')
    const s = Styles.collapseStyles([flex != null && flex !== 1 ? {flex} : undefined, _style]) as React.CSSProperties
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn}
        onClick={onClick}
        onMouseOver={onMouseOver}
        style={s}
        data-testid={testID}
      >
        {children}
      </div>
    )
  }

  const {style: s, children: c} = box2SharedProps(box2p)
  return (
    <Pressable
      ref={ref as React.Ref<View>}
      onPress={onClick ? () => { onClick() } : undefined}
      onLongPress={onLongPress}
      style={s}
      hitSlop={hitSlop}
      testID={box2p.testID}
    >
      {c}
    </Pressable>
  )
}
