import * as React from 'react'
import * as Styles from '@/styles'
import type {Props} from './scroll-view'

const ScrollView = React.forwardRef(function ScrollView(props: Props, ref) {
  const {className, contentContainerStyle, onScroll, style, children} = props
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
      scrollToEnd: () => {
        divRef.current &&
          divRef.current.scrollTo({
            left: divRef.current.scrollWidth,
          })
      },
    }),
    [divRef]
  )

  return (
    <div
      className={cn}
      style={Styles.collapseStylesDesktop([styles.overflowAuto, style])}
      onScroll={onScroll as any /* TODO FIX */}
      ref={divRef}
    >
      <div style={Styles.castStyleDesktop(contentContainerStyle)}>{children}</div>
    </div>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  overflowAuto: Styles.platformStyles({
    isElectron: {
      overflow: 'auto',
    },
  }),
}))

export default ScrollView
