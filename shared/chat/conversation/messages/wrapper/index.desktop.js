// @flow
import WrapperTimestamp from './wrapper-timestamp'
import WrapperAuthor from './wrapper-author'
import {withHandlers} from '../../../../util/container'
import {FloatingMenuParentHOC} from '../../../../common-adapters/floating-menu'

const WrapperWithFloatingMenu = withHandlers({
  onShowMenu: props => event => {
    const node = event.target instanceof window.HTMLElement ? event.target : null
    props.onShowMenu(node ? node.getBoundingClientRect() : null)
  },
})(FloatingMenuParentHOC(WrapperAuthor))

export {WrapperWithFloatingMenu as WrapperAuthor, WrapperTimestamp}
