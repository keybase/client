import type {Props} from './drag-and-drop.shared'

const RenderChildren = (props: Props): React.ReactNode => props.children || null

// Do nothing
export {RenderChildren as default}
