// @flow
import React from 'react'
import {globalStyles} from '../../styles/style-guide'
import {BackButton} from '../../common-adapters'
import type {Props} from './container'

export default ({children, onBack, style, outerStyle}: Props) => {
  return (
    <div style={{...styles.container, ...outerStyle}}>
      {onBack && <BackButton style={styles.button} onClick={onBack} />}
      <div style={{...styles.innerContainer, ...style}}>
        {children}
      </div>
    </div>
  )
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'flex-start',
    bottom: 0,
    justifyContent: 'flex-start',
    left: 0,
    padding: 60,
    position: 'absolute',
    right: 0,
    top: 0
  },
  innerContainer: {
    ...globalStyles.flexBoxColumn,
    alignSelf: 'stretch',
    width: '100%',
    height: '100%'
  },
  button: {
    zIndex: 9999,
    position: 'absolute'
  }
}
