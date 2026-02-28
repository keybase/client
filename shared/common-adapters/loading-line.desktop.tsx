import Box from './box'
import * as React from 'react'
import * as Styles from '@/styles'
import './loading-line.css'

const Kb = {Box}

const LoadingLine = React.memo(function LoadingLine() {
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box className="loading-line" style={styles.line} />
    </Kb.Box>
  )
})

const styles = Styles.styleSheetCreate(() => ({
  container: {
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  line: {
    backgroundColor: Styles.globalColors.blue,
    height: 1,
  },
}))

export default LoadingLine
