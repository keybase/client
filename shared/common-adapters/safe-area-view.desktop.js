// @flow
import type {SafeAreaViewTopBottomProps} from './safe-area-view'

const RenderChildren = (props: SafeAreaViewTopBottomProps) => props.children

// Do nothing
export {RenderChildren as default, RenderChildren as SafeAreaViewTop, RenderChildren as SafeAreaViewTopBottom}
