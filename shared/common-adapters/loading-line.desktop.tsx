import {Box2} from './box'
import * as React from 'react'
import * as Styles from '@/styles'
import './loading-line.css'

const Kb = {Box2}

const LoadingLine = React.memo(function LoadingLine() {
  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.Box2 direction="vertical" fullWidth={true} className="loading-line" style={styles.line} />
    </Kb.Box2>
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
