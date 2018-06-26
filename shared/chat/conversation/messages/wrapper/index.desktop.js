// @flow
import {MessageWrapper, MessageWrapperUserContent} from './shared'
import {withHandlers} from '../../../../util/container'
import {FloatingMenuParentHOC} from '../../../../common-adapters/floating-menu'

const WrapperWithFloatingMenu = withHandlers({
  onShowMenu: props => event => {
    const node = event.target instanceof window.HTMLElement ? event.target : null
    props.onShowMenu(node ? node.getBoundingClientRect() : null)
  },
})(FloatingMenuParentHOC(MessageWrapperUserContent))

export {WrapperWithFloatingMenu as WrapperUserContent, MessageWrapper as Wrapper}
export default MessageWrapper
