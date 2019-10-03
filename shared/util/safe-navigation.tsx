import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {getActiveKey} from '../router-v2/util'
import {NavigationInjectedProps, withNavigation} from '@react-navigation/core'
import {hoistNonReactStatic} from './container'
import {useNavigationState} from './navigation-hooks'

type Path = Array<string | {props?: any; selected?: string}>

export type PropsWithSafeNavigation<P = {}> = {
  safeNavigateAppendPayload: (arg0: {path: Path; replace?: boolean}) => RouteTreeGen.NavigateAppendPayload
  safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
  navKey: string
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
    _activeKey: string = ''

    _navigateAppend = ({path, replace}: {path: Path; replace?: boolean}) =>
      RouteTreeGen.createNavigateAppend({fromKey: this._activeKey, path, replace})

    _navigateUp = () => RouteTreeGen.createNavigateUp({fromKey: this._activeKey})

    render() {
      this._activeKey = getActiveKey(this.props.navigation.state)
      const {forwardedRef, ...rest} = this.props
      return (
        // @ts-ignore
        <Component
          ref={forwardedRef}
          {...rest}
          safeNavigateAppendPayload={this._navigateAppend}
          safeNavigateUpPayload={this._navigateUp}
          navKey={this._activeKey}
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

const useSafeNavigationReal: () => PropsWithSafeNavigation = () => {
  const state = useNavigationState()
  const fromKey = getActiveKey(state)
  return React.useMemo(
    () => ({
      navKey: fromKey,
      safeNavigateAppendPayload: ({path, replace}) =>
        RouteTreeGen.createNavigateAppend({fromKey, path, replace}),
      safeNavigateUpPayload: () => RouteTreeGen.createNavigateUp({fromKey}),
    }),
    [fromKey]
  )
}

const useSafeNavigationStorybook: () => PropsWithSafeNavigation = () => {
  return {
    navKey: '',
    safeNavigateAppendPayload: ({path, replace}) => RouteTreeGen.createNavigateAppend({path, replace}),
    safeNavigateUpPayload: () => RouteTreeGen.createNavigateUp({}),
  }
}

export const useSafeNavigation = __STORYBOOK__ ? useSafeNavigationStorybook : useSafeNavigationReal

export default (__STORYBOOK__ ? withSafeNavigationStorybook : withSafeNavigation)
