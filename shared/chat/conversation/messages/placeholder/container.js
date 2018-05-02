// @flow
import Placeholder from '.'
import {mapProps} from '../../../../util/container'

export default mapProps(props => ({
  ordinal: props.message.ordinal,
}))(Placeholder)
