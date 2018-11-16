// @flow
import * as React from 'react'
import {BackButton} from '../../common-adapters'
import {globalStyles} from '../../styles'

import type {Props} from './container'

const Container = ({children, onBack, style, outerStyle}: Props) => {
  return (
    <div style={{...stylesContainer, ...outerStyle}}>
      {onBack /* sketchy */ && <BackButton style={stylesButton} onClick={onBack} />}
      <div style={{...stylesInnerContainer, ...style}}>{children}</div>
    </div>
  )
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  padding: 64,
  flex: 1,
}

const stylesInnerContainer = {
  ...globalStyles.flexBoxColumn,
  alignSelf: 'stretch',
  width: '100%',
  height: '100%',
}

const stylesButton = {
  zIndex: 9999,
  position: 'absolute',
}

export default Container
