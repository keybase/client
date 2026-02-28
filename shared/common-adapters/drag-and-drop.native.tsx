import type {Props} from './drag-and-drop'

const RenderChildren = (props: Props): React.ReactNode => props.children || null

// Do nothing
export {RenderChildren as default}
