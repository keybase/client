// @flow
import React from 'react'
import {globalStyles} from '../../styles/style-guide'
import {BackButton} from '../../common-adapters'
import type {Props} from './container'

export default ({children, onBack, style, outerStyle}: Props) => {
  return (
    <div style={{...stylesContainer, ...outerStyle}}>
      {onBack && <BackButton style={stylesButton} onClick={onBack} />}
      <div style={{...stylesInnerContainer, ...style}}>
        {children}
      </div>
    </div>
  )
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  bottom: 0,
  justifyContent: 'flex-start',
  left: 0,
  padding: 60,
  position: 'absolute',
  right: 0,
  top: 0
}

const stylesInnerContainer = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'stretch',
  width: '100%',
  height: '100%'
}

const stylesButton = {
  zIndex: 9999,
  position: 'absolute'
}
