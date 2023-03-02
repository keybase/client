import * as React from 'react'
import type {NavigationContainerRef} from '@react-navigation/core'
import type {NavState} from '../constants/types/route-tree'
import type * as Styles from '../styles'
export const tabBarStyle: Styles.StylesCrossPlatform
export const headerDefaultStyle: Styles.StylesCrossPlatform
export const defaultNavigationOptions: {
  header?: (p: any) => React.ReactNode
  headerBackTitle?: string
  headerBackVisible?: boolean
  headerBackgroundContainerStyle?: Styles.StylesCrossPlatform
  headerLeft?: (p: any) => React.ReactNode
  headerLeftContainerStyle?: Styles.StylesCrossPlatform
  headerRightContainerStyle?: Styles.StylesCrossPlatform
  headerStyle?: Styles.StylesCrossPlatform
  headerTitle?: (hp: any) => React.ReactNode
  headerTitleContainerStyle?: Styles.StylesCrossPlatform
}

export declare class TabletWrapper extends React.Component<{children: React.ReactNode}> {}

export function useSubnavTabAction(
  navigation: NavigationContainerRef<{}>,
  state: NavState
): (t: string) => void
