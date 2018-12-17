// @flow
import * as React from 'react'
import type {SafeAreaViewTopBottomProps} from './safe-area-view'

const RenderChildren = (props: SafeAreaViewTopBottomProps) => (
  <React.Fragment>{props.children}</React.Fragment>
)

// Just act like a box
export {Box as default, Box as SafeAreaViewTop} from './box'
export {RenderChildren as SafeAreaViewTopBottom}
