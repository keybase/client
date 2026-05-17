import type * as React from 'react'
import type * as Styles from '@/styles'

export type Props = {
  allowFolders?: boolean
  children: React.ReactNode
  containerStyle?: Styles.StylesCrossPlatform
  disabled?: boolean
  fullHeight?: boolean
  fullWidth?: boolean
  onAttach?: (array: Array<string>) => void
  prompt?: string
  rejectReason?: string
}
