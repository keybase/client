import type * as React from 'react'
import type * as Styles from '@/styles'

type Props = {
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
const RenderChildren = (props: Props): React.ReactNode => props.children || null

// Do nothing
export {RenderChildren as default}
