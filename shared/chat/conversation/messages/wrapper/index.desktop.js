// @flow
import Wrapper from './shared'
import {withHandlers} from '../../../../util/container'

export default withHandlers({
  onShowMenu: props => event => {
    const node = event.target instanceof window.HTMLElement ? event.target : null
    props.onShowMenu(node ? node.getBoundingClientRect() : null)
  },
})(Wrapper)
