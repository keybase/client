import {Props} from './safe-area-view'

const RenderChildren = (props: Props) => props.children || null
export const useSafeArea = () => ({
  bottom: 0,
  left: 0,
  right: 0,
  top: 0,
})

// Do nothing
export {RenderChildren as default, RenderChildren as SafeAreaViewTop}
