import type * as React from 'react'

export type Props = {
  children: React.ReactNode
  isModal?: boolean
  extraOffset?: number
  extraPadding?: number
  compensateNotBeingOnBottom?: boolean
  behavior?: 'height' | 'padding' | 'translate-with-padding'
}
