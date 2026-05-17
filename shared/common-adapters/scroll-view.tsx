import * as React from 'react'
import * as Styles from '@/styles'
import {ScrollView as NativeScrollView} from 'react-native'
import type {ScrollViewProps} from 'react-native'
import type {Props} from './scroll-view.shared'

export type {ScrollViewRef} from './scroll-view.shared'

type DivScrollable = {
  scrollTo: (opts: {left?: number; top?: number}) => void
  readonly scrollWidth: number
}

function ScrollView(props: Props) {
  const {ref: outerRef, ...rest} = props

  const divRef = React.useRef<DivScrollable | null>(null)
  const innerRef = React.useRef<NativeScrollView | null>(null)

  React.useImperativeHandle(outerRef, () => ({
    scrollTo: (args: {x: number; y: number; animated?: boolean}) => {
      if (Styles.isMobile) {
        innerRef.current?.scrollTo(args)
      } else {
        divRef.current?.scrollTo({left: args.x, top: args.y})
      }
    },
    scrollToEnd: (opts?: {animated?: boolean; duration?: number}) => {
      if (Styles.isMobile) {
        innerRef.current?.scrollToEnd(opts)
      } else {
        divRef.current?.scrollTo({left: divRef.current.scrollWidth})
      }
    },
  }))

  if (!Styles.isMobile) {
    const {className, contentContainerStyle, onScroll, style, children} = rest
    const {showsHorizontalScrollIndicator, showsVerticalScrollIndicator} = rest
    const hideScroll =
      showsVerticalScrollIndicator === false && showsHorizontalScrollIndicator === false
    const cn = Styles.classNames(
      {'hide-scrollbar': hideScroll},
      {'scroll-container': hideScroll},
      className
    )
    const onScroll_ = (e: {currentTarget: DivScrollable}) => {
      onScroll?.({currentTarget: e.currentTarget as never})
    }
    return (
      <div
        className={cn}
        style={Styles.collapseStylesDesktop([styles.overflowAuto, style]) as React.CSSProperties}
        onScroll={onScroll_ as never}
        ref={divRef as React.RefObject<HTMLDivElement>}
      >
        <div style={Styles.castStyleDesktop(contentContainerStyle)}>{children}</div>
      </div>
    )
  }

  const nativeProps = rest as ScrollViewProps
  const keyboardShouldPersistTaps = nativeProps.keyboardShouldPersistTaps ?? 'handled'
  const contentInsetAdjustmentBehavior =
    nativeProps.contentInsetAdjustmentBehavior ?? 'automatic'
  return (
    <NativeScrollView
      ref={innerRef}
      {...nativeProps}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      overScrollMode="never"
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  overflowAuto: Styles.platformStyles({
    isElectron: {overflow: 'auto'},
  }),
}))

export default ScrollView
