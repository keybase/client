import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {getActiveKey} from '../router-v2/util'
import {NavigationInjectedProps, withNavigation} from '@react-navigation/core'
import {hoistNonReactStatic} from '../util/container'
import {useNavigationState} from './navigation-hooks'

type Path = Array<string | {props?: any; selected?: string}>

export type PropsWithSafeNavigation<P> = {
  safeNavigateAppendPayload: (arg0: {path: Path; replace?: boolean}) => RouteTreeGen.NavigateAppendPayload
  safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
} & P

function withSafeNavigation<P extends {}>(
  Component: React.ComponentType<PropsWithSafeNavigation<P>>
): React.ComponentType<P> {
  type WithSafeNavigationProps = {
    forwardedRef: React.Ref<React.ComponentType<P>>
  } & NavigationInjectedProps &
    P

  class WithSafeNavigation extends React.Component<WithSafeNavigationProps> {
    static displayName = `WithSafeNavigation(${Component.displayName || Component.name || 'Component'})`

    _navigateAppend = ({path, replace}: {path: Path; replace?: boolean}) =>
      RouteTreeGen.createNavigateAppend({fromKey: getActiveKey(this.props.navigation.state), path, replace})

    _navigateUp = () => RouteTreeGen.createNavigateUp({fromKey: getActiveKey(this.props.navigation.state)})

    render() {
      const {forwardedRef, ...rest} = this.props
      return (
        // @ts-ignore
        <Component
          ref={forwardedRef}
          {...rest}
          safeNavigateAppendPayload={this._navigateAppend}
          safeNavigateUpPayload={this._navigateUp}
        />
      )
    }
  }

  hoistNonReactStatic(WithSafeNavigation, Component)

  const WithForwardRef = React.forwardRef((props: WithSafeNavigationProps, ref) => (
    <WithSafeNavigation {...props} forwardedRef={ref} />
  ))

  hoistNonReactStatic(WithForwardRef, WithSafeNavigation)
  WithForwardRef.displayName = `ForwardRef(WithSafeNavigation)`

  const WithNav = withNavigation(WithForwardRef)
  hoistNonReactStatic(WithNav, WithForwardRef)
  // @ts-ignore not exactly sure
  return WithNav
}

function withSafeNavigationStorybook<P extends {}>(
  Component: React.ComponentType<PropsWithSafeNavigation<P>>
): React.ComponentType<P> {
  return props => (
    // @ts-ignore
    <Component getParam={(key: string) => ''} navigateAppend={() => {}} navigateUp={() => {}} {...props} />
  )
}

export const useSafeNavigation: () => PropsWithSafeNavigation<{}> = () => {
  const state = useNavigationState()
  const fromKey = getActiveKey(state)
  return React.useMemo(
    () => ({
      safeNavigateAppendPayload: ({path, replace}) =>
        RouteTreeGen.createNavigateAppend({fromKey, path, replace}),
      safeNavigateUpPayload: () => RouteTreeGen.createNavigateUp({fromKey}),
    }),
    [fromKey]
  )
}

export default (__STORYBOOK__ ? withSafeNavigationStorybook : withSafeNavigation)
