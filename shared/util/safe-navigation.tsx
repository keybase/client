import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {getActiveKey} from '../router-v2/util'
import {withNavigation} from '@react-navigation/core'

type Path = Array<
  | string
  | {
      props?: any
      selected?: string
    }
>

type NavProps = {
  navigateAppend: (
    arg0: {
      path: Path
      replace?: boolean
    }
  ) => RouteTreeGen.NavigateAppendPayload | void
  navigateUp: () => RouteTreeGen.NavigateUpPayload | void
}

export type PropsWithSafeNavigation<P> = {
  navigateAppend: (
    arg0: {
      path: Path
      replace?: boolean
    }
  ) => RouteTreeGen.NavigateAppendPayload
  navigateUp: () => RouteTreeGen.NavigateUpPayload
} & P

function withSafeNavigation<P extends {}>(
  Component: React.ComponentType<P>
): React.Component<Exclude<P, NavProps>> {
  type WithSafeNavigationProps = {
    forwardedRef: React.Ref<React.ComponentType<P>>
    navigation: any
  } & Exclude<P, NavProps>

  class WithSafeNavigation extends React.Component<WithSafeNavigationProps> {
    static displayName = `WithSafeNavigation(${Component.displayName || Component.name || 'Component'})`

    _navigateAppend = ({path, replace}) =>
      RouteTreeGen.createNavigateAppend({fromKey: getActiveKey(this.props.navigation.state), path, replace})

    _navigateUp = () => RouteTreeGen.createNavigateUp({fromKey: getActiveKey(this.props.navigation.state)})

    render() {
      const {navigation, forwardedRef, ...rest} = this.props
      return (
        <Component
          ref={forwardedRef}
          {...rest as P}
          navigateAppend={this._navigateAppend}
          navigateUp={this._navigateUp}
        />
      )
    }
  }
  const WithForwardRef = React.forwardRef((props: WithSafeNavigationProps, ref) => (
    <WithSafeNavigation {...props} forwardedRef={ref} />
  ))
  WithForwardRef.displayName = `ForwardRef(WithSafeNavigation)`
  return withNavigation(WithForwardRef)
}

export default withSafeNavigation
