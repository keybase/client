import type * as React from 'react'
import type {HeaderOptions} from '@react-navigation/elements'
type HeaderBackButtonProps = Parameters<NonNullable<HeaderOptions['headerLeft']>>[0]

export declare const HeaderLeftArrow: (p: HeaderBackButtonProps & {badgeNumber?: number}) => React.ReactNode
export declare const HeaderLeftArrowCanGoBack: (
  p: Omit<HeaderBackButtonProps, 'canGoBack'> & {badgeNumber?: number}
) => React.ReactNode
export declare const HeaderLeftCancel: (p: HeaderBackButtonProps) => React.ReactNode
export declare const HeaderLeftCancel2: (p: HeaderBackButtonProps) => React.ReactNode

export type {HeaderBackButtonProps} from '@react-navigation/elements'
