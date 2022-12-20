import * as React from 'react'
import ReactList from 'react-list'
import {useFocusEffect} from '@react-navigation/core'

// Default ReactList will get into a bad state if it redraws while in a hidden parent (like in a stack)
// to fix we force a redraw when we're back visible

type ItemRenderer = (index: number, key: number | string) => JSX.Element
type ItemsRenderer = (items: JSX.Element[], ref: string) => JSX.Element
type ItemSizeEstimator = (index: number, cache: {}) => number
type ItemSizeGetter = (index: number) => number
type ScrollParentGetter = () => JSX.Element
type ReactListProps = {
  children?: React.ReactNode
  ref?: React.LegacyRef<ReactList> | undefined
  axis?: 'x' | 'y' | undefined
  initialIndex?: number | undefined
  itemRenderer?: ItemRenderer | undefined
  itemSizeEstimator?: ItemSizeEstimator | undefined
  itemSizeGetter?: ItemSizeGetter | undefined
  itemsRenderer?: ItemsRenderer | undefined
  length?: number | undefined
  minSize?: number | undefined
  pageSize?: number | undefined
  scrollParentGetter?: ScrollParentGetter | undefined
  threshold?: number | undefined
  type?: string | undefined
  useStaticSize?: boolean | undefined
  useTranslate3d?: boolean | undefined
}

const SafeReactList = React.forwardRef<ReactList, ReactListProps>(function SafeReactList(p, ref) {
  const [force, setForce] = React.useState(0)
  const mountedRef = React.useRef(true)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [mountedRef])

  useFocusEffect(
    React.useCallback(() => {
      setTimeout(() => {
        if (mountedRef.current) {
          setForce(i => i + 1)
        }
      }, 1)
    }, [])
  )

  return (
    <ReactList
      // we have to entirely redraw as it has internal caching which is ruined with no way to clear it, this matches the old behavior
      key={String(force)}
      {...p}
      // @ts-ignore ref
      ref={ref}
    />
  )
})

export default SafeReactList
