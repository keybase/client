// @flow
import * as React from 'react'

export class CancelProvisioningHelper extends React.Component<{
  navigation: any,
  children: React.Node,
}> {
  componentDidMount() {
    const {navigation} = this.props
    navigation.setParams({
      customOnBack: () => navigation.popToTop(),
    })
  }
  render() {
    return this.props.children
  }
}

export default function CancelProvisioningHelperHoc<P: {}>(
  Component: React.AbstractComponent<P>
): React.AbstractComponent<P & {navigation: any}> {
  const _C = (p: P & {navigation: any}) => (
    <CancelProvisioningHelper navigation={p.navigation}>
      <Component {...(p: P)} />
    </CancelProvisioningHelper>
  )

  // Setting header to undefined unsets the null setting from before.
  // This lets the header show up on native
  _C.navigationOptions = {header: undefined}
  return _C
}
