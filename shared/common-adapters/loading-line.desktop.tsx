import Box from './box'
import * as React from 'react'
import * as Styles from '../styles'

const Kb = {
  Box,
}

const LoadingLine = React.memo<{}>(() => {
  const realCSS = `
    @keyframes fadeIn {
      from { opacity: 0; }
    }

    .loading-line {
      animation: fadeIn 1s infinite alternate;
    }
`
  return (
    <Kb.Box style={styles.container}>
      <style>{realCSS}</style>
      <Kb.Box className="loading-line" style={styles.line} />
    </Kb.Box>
  )
})

const styles = Styles.styleSheetCreate({
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
})

export default LoadingLine
