import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './scroll-view'

function ScrollView(props: Props) {
  const {className, contentContainerStyle, onScroll, style, children, ref} = props
  const {showsHorizontalScrollIndicator, showsVerticalScrollIndicator} = props
  const hideScroll = showsVerticalScrollIndicator === false && showsHorizontalScrollIndicator === false
  const cn = Styles.classNames(
    // TODO: make it work for horizontal/vertical separately
    // .hide-vertical-scrollbar::-webkit-scrollbar:vertical doesn't work.
    {'hide-scrollbar': hideScroll},
    {'scroll-container': hideScroll},
    className
  )
  const divRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(
    ref,
    () => ({
      scrollTo: (arg0: {x: number; y: number; animated?: boolean}) => {
        divRef.current?.scrollTo({left: arg0.x, top: arg0.y})
      },
      scrollToEnd: () => {
        divRef.current?.scrollTo({
          left: divRef.current.scrollWidth,
        })
      },
    }),
    [divRef]
  )

  const onScroll_ = (e: React.UIEvent<HTMLDivElement>) => {
    onScroll?.({currentTarget: e.currentTarget})
  }

  return (
    <div
      className={cn}
      style={Styles.collapseStylesDesktop([styles.overflowAuto, style])}
      onScroll={onScroll_}
      ref={divRef}
    >
      <div style={Styles.castStyleDesktop(contentContainerStyle)}>{children}</div>
    </div>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  overflowAuto: Styles.platformStyles({
    isElectron: {
      overflow: 'auto',
    },
  }),
}))

export default ScrollView
