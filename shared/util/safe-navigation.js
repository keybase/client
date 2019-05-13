// @flow
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
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
    _navigateAppend = ({path, replace}) =>
      RouteTreeGen.createNavigateAppend({fromKey: this.props.navigation.state.key, path, replace})

    _navigateUp = () => RouteTreeGen.createNavigateUp({fromKey: this.props.navigation.state.key})

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
  return withNavigation(WithForwardRef)
}

export default withSafeNavigation
