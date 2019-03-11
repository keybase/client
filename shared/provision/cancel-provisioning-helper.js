// @flow
import * as React from 'react'

export default function CancelProvisioningHelperHoc<P>(
  Component: React.AbstractComponent<P>
): React.AbstractComponent<P> {
  // $FlowIssue
  Component.navigationOptions = ({navigation}) => {
    if (!navigation.getParam('customOnBack')) {
      navigation.setParams({
        customOnBack: () => navigation.popToTop(),
      })
    }

    return {header: undefined}
  }

  return Component
}
