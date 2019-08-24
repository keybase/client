import {Props} from './safe-area-view'

const RenderChildren = (props: Props) => props.children || null

// Do nothing
export {RenderChildren as default, RenderChildren as SafeAreaViewTop}
