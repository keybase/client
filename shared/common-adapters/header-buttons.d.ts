import type * as React from 'react'
import type {HeaderOptions} from '@react-navigation/elements'
type HeaderBackButtonProps = Parameters<NonNullable<HeaderOptions['headerLeft']>>[0]

export declare function HeaderLeftButton(
  p: HeaderBackButtonProps & {
    badgeNumber?: number
    mode?: 'back' | 'cancel'
    autoDetectCanGoBack?: boolean
  }
): React.ReactNode

export type {HeaderBackButtonProps}
