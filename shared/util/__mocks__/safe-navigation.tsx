import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Sb from '../../stories/storybook'

type Path = Array<string | {props?: any; selected?: string}>

export type PropsWithSafeNavigation<P> = {
  safeNavigateAppendPayload: (arg0: {path: Path; replace?: boolean}) => RouteTreeGen.NavigateAppendPayload
  safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
} & P

export function withSafeNavigation<P extends {}>(
  Component: React.ComponentType<PropsWithSafeNavigation<P>>
): React.ComponentType<P> {
  return props => (
    // @ts-ignore
    <Component getParam={(key: string) => ''} navigateAppend={() => {}} navigateUp={() => {}} {...props} />
  )
}

// @ts-ignore
export const useSafeNavigation: () => PropsWithSafeNavigation<{}> = () => {
  return {
    safeNavigateAppendPayload: _ => Sb.action('navigateAppend'),
    safeNavigateUpPayload: () => Sb.action('navigateUp'),
  }
}
