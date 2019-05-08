// @flow
import * as React from 'react'
import {withNavigation} from '@react-navigation/core'

type Path = Array<string | {|props?: any, selected: string|}>

export type SafeNavigationProps<OriginalProps> = {|
  ...$Exact<OriginalProps>,
  navigateAppend: ({path: Path, replace?: boolean}) => void,
  navigateUp: () => void,
|}

function withSafeNavigation<WrappedOwnProps: {}, Instance>(
  Component: React.AbstractComponent<SafeNavigationProps<WrappedOwnProps>, Instance>
): React.AbstractComponent<WrappedOwnProps, Instance> {
  type WithSafeNavigationProps = {|
    ...$Exact<WrappedOwnProps>,
    forwardedRef: React.Ref<React.AbstractComponent<WrappedOwnProps, Instance>>,
    navigation: any,
  |}

  class _WithSafeNavigation extends React.Component<WithSafeNavigationProps> {
    _navigateAppend = ({path, replace}) => {}
    _navigateUp = () => {
      const {navigation} = this.props
      navigation.goBack(navigation.state.key)
    }
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
  const WithSafeNavigation = withNavigation(_WithSafeNavigation)
  return React.forwardRef<WrappedOwnProps, Instance>((props, ref) => (
    <WithSafeNavigation {...props} forwardedRef={ref} />
  ))
}

export default withSafeNavigation
