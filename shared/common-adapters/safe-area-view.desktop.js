// @flow
import * as React from 'react'
import type {SafeAreaViewTopBottomProps} from './safe-area-view'

const RenderChildren = (props: SafeAreaViewTopBottomProps) => (
  <React.Fragment>{props.children}</React.Fragment>
)

// Do nothing
export {RenderChildren as default, RenderChildren as SafeAreaViewTop, RenderChildren as SafeAreaViewTopBottom}
