import * as React from 'react'
import {StylesCrossPlatform} from '../../../../../styles'
export type Props = {
  children?: React.ElementType
  explodedBy: string | null
  exploding: boolean
  measure: () => void | null
  messageKey: string
  style?: StylesCrossPlatform
  retainHeight: boolean
}
