// @flow
import * as React from 'react'
import {Box} from './box'
import {Gateway} from 'react-gateway'

type Props = {
  children?: React.Node,
  onHidden: () => void, // will be triggered automatically only on click/tap outside the box
  // gatewayID: string, TODO
  // Desktop only - the node that we should aim for
  // optional because desktop only, nullable because refs always are
  attachTo?: ?React.Component<any, any>,
  // Desktop only - allow clicks outside the floating box to propagate
  propagateOutsideClicks?: boolean,
  containerStyle?: StylesCrossPlatform,
  position?: Position,
}

export default (props: Props) => {
  return (
    <Gateway into="popup-root">
      <Box style={[{position: 'relative', width: '100%', height: '100%'}, props.containerStyle]}>
        {props.children}
      </Box>
    </Gateway>
  )
}
