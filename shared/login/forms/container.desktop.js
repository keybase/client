// @flow
import React from 'react'
import {globalStyles} from '../../styles/style-guide'
import {BackButton} from '../../common-adapters'
import type {Props} from './container'

export default ({children, onBack, style, outerStyle}: Props) => {
  return (
    <div style={{...styles.container, ...outerStyle}}>
      <BackButton onClick={() => onBack()}/>
      <div style={{...styles.innerContainer, ...style}}>
        {children}
      </div>
    </div>
  )
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 65,
    position: 'relative'
  },
  innerContainer: {
    ...globalStyles.flexBoxColumn,
    alignSelf: 'stretch',
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    bottom: 0
  }
}
