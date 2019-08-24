import {NativeTouchableHighlight} from '../../../../../common-adapters/mobile.native'

/**
 * This exists so we can attach onLongPress on native without having to do a
 * more major layout split. '.native' exports NativeTouchableHighlight while
 * '.desktop. exports Box. Note that NativeTouchableHighlight only supports one
 * child so multiple children will need to be wrapped.
 */

export default NativeTouchableHighlight
