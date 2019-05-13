// @flow
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {getActiveKey} from '../router-v2/util'
import {withNavigation} from '@react-navigation/core'

type Path = Array<string | {|props?: any, selected?: string|}>

type NavProps = {
  navigateAppend: (({path: Path, replace?: boolean}) => RouteTreeGen.NavigateAppendPayload) | void,
  navigateUp: (() => RouteTreeGen.NavigateUpPayload) | void,
}

export type PropsWithSafeNavigation<P> = {|
  ...$Exact<P>,
  navigateAppend: ({path: Path, replace?: boolean}) => RouteTreeGen.NavigateAppendPayload,
  navigateUp: () => RouteTreeGen.NavigateUpPayload,
|}

function withSafeNavigation<Config: {}, Instance>(
  Component: React.AbstractComponent<Config, Instance>
): React.AbstractComponent<$Diff<Config, NavProps>, Instance> {
  type WithSafeNavigationProps = {|
    ...$Exact<$Diff<Config, NavProps>>,
    forwardedRef: React.Ref<React.AbstractComponent<Config, Instance>>,
    navigation: any, // TODO better typing
  |}

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
          {...rest}
          navigateAppend={this._navigateAppend}
          navigateUp={this._navigateUp}
        />
      )
    }
  }
  const WithForwardRef = React.forwardRef((props, ref) => (
    <WithSafeNavigation {...props} forwardedRef={ref} />
  ))
  WithForwardRef.displayName = `ForwardRef(WithSafeNavigation)`
  return withNavigation(WithForwardRef)
}

export default withSafeNavigation
