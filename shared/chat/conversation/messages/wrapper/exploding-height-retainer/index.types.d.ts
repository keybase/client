import * as React from 'react'
import {StylesCrossPlatform} from '../../../../../styles'
export type Props = {
  children?: React.ReactNode
  explodedBy?: string
  exploding: boolean
  measure?: () => void
  messageKey: string
  style?: StylesCrossPlatform
  retainHeight: boolean
}
