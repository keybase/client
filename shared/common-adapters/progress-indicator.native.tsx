import * as React from 'react'
import type {Props} from './progress-indicator'
import {ActivityIndicator} from 'react-native'
import {globalColors, collapseStyles} from '@/styles'

const ProgressIndicator = (p: Props) => {
  const size = p.type === 'Large' ? 'large' : 'small'

  return (
    <ActivityIndicator
      color={p.white ? globalColors.whiteOrWhite : globalColors.black}
      size={size}
      style={collapseStyles([style, p.style])}
    />
  )
}

const style = {
  alignItems: 'center',
  justifyContent: 'center',
} as const

export default ProgressIndicator
