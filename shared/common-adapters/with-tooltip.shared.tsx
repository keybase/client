import type * as React from 'react'
import type {StylesCrossPlatform, Position} from '@/styles'

export type Props = {
  backgroundColor?: string
  disabled?: boolean
  tooltip: string | React.ReactNode
  multiline?: boolean
  containerStyle?: StylesCrossPlatform
  children: React.ReactNode
  position?: Position
  className?: string
  toastClassName?: string
  toastStyle?: StylesCrossPlatform
  textStyle?: StylesCrossPlatform
  showOnPressMobile?: boolean
}
