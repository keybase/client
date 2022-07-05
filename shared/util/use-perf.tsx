import * as React from 'react'
import {Box2} from '../common-adapters/box'
import Text from '../common-adapters/text'
import * as Styles from '../styles'
/**
A hook to measure rendering perf of a component, use the return value as a key
 */

export const usePerf = (count: number = 10) => {
  const [numRenders, setNumRenders] = React.useState(0)
  const startTime = React.useRef<number>(0)
  const runTime = React.useRef<number>(0)
  const running = React.useRef<boolean>(false)

  const reset = React.useCallback(() => {
    setNumRenders(0)
  }, [setNumRenders])

  if (numRenders === 0 && !running.current) {
    running.current = true
    startTime.current = Date.now()
    runTime.current = 0
    console.log('usePerf start:', count)
  }

  React.useEffect(() => {
    console.log('usePerf useEffect ran')
    if (running.current) {
      runTime.current = Date.now() - startTime.current
      if (numRenders === count) {
        // done?
        running.current = false
        setNumRenders(-1)
        console.log('usePerf end: ', runTime.current)
      } else {
        // some components defer so lets actually render them
        setImmediate(() => {
          console.log('usePerf increment ran')
          setNumRenders(s => s + 1)
        })
      }
    }
  }, [numRenders, setNumRenders, count])

  return [String(numRenders), runTime.current, reset] as const
}

type Props = {
  perfCount?: number
  prefix?: string
  children: React.ReactNode
  style?: Styles.StylesCrossPlatform
}
const _PerfWrapper = (props: Props) => {
  const {perfCount, children, style, prefix} = props
  const [key, time, reset] = usePerf(perfCount)
  return (
    <Box2 direction="vertical" key={key} style={Styles.collapseStyles([styles.container, style])}>
      {children}
      <Text type="Body" style={styles.time} onClick={reset}>
        {prefix ?? ''}
        {time}
      </Text>
    </Box2>
  )
}

export const PerfWrapper = React.memo(_PerfWrapper)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    position: 'relative',
  },
  time: {
    alignSelf: 'flex-end',
    backgroundColor: Styles.globalColors.yellow,
    color: Styles.globalColors.blackOrBlack,
    minWidth: 80,
    opacity: 0.8,
    padding: 10,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 9999,
  },
}))
