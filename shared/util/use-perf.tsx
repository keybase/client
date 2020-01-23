import * as React from 'react'
import {Box2} from '../common-adapters/box'
import Text from '../common-adapters/text'
import * as Styles from '../styles'
/** 
A dev only hook to measure rendering perf of a component, use the return value as a key
 */

export const usePerf = __DEV__
  ? (count: number = 10) => {
      const [numRenders, setNumRenders] = React.useState(0)
      const startTime = React.useRef<number>(0)
      const reset = React.useCallback(() => {
        setNumRenders(0)
      }, [setNumRenders])

      if (startTime.current === 0) {
        startTime.current = Date.now()
        console.log('usePerf start:', count)
      }

      React.useEffect(() => {
        if (numRenders >= count) {
          console.log('usePerf end: ', Date.now() - startTime.current)
          return
        }
        setNumRenders(numRenders + 1)
      }, [numRenders, setNumRenders])

      return [String(numRenders), Date.now() - startTime.current, reset] as const
    }
  : (_: number = 1000) => ['prod', 0, () => {}] as const

type Props = {
  perfCount?: number
  children: React.ReactNode
  style?: Styles.StylesCrossPlatform
}
export const PerfWrapper = (props: Props) => {
  const {perfCount, children, style} = props
  const [key, time, reset] = usePerf(perfCount)
  return (
    <Box2 direction="vertical" key={key} style={Styles.collapseStyles([styles.container, style])}>
      {children}
      <Text type="Body" style={styles.time} onClick={reset}>
        {time}
      </Text>
    </Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    position: 'relative',
  },
  time: {
    backgroundColor: Styles.globalColors.yellow,
    color: Styles.globalColors.black,
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 9999,
  },
}))
