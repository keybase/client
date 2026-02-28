import Box from './box'
import {TouchableWithoutFeedback} from 'react-native'
import * as Styles from '@/styles'

import type {Props} from './popup-dialog'

export function PopupDialog({children, onClose, styleCover, styleContainer}: Props) {
  return (
    <TouchableWithoutFeedback onPress={onClose || undefined}>
      <Box style={{...coverStyle, ...styleCover}}>
        <TouchableWithoutFeedback>
          <Box style={{...containerStyle, ...styleContainer}}>{children}</Box>
        </TouchableWithoutFeedback>
      </Box>
    </TouchableWithoutFeedback>
  )
}

const coverStyle = {
  ...Styles.globalStyles.flexBoxCenter,
  ...Styles.globalStyles.fillAbsolute,
  backgroundColor: Styles.globalColors.black,
  paddingBottom: Styles.globalMargins.small,
  paddingLeft: Styles.globalMargins.large,
  paddingRight: Styles.globalMargins.large,
  paddingTop: Styles.globalMargins.small,
} as const

const containerStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  backgroundColor: Styles.globalColors.white,
  borderRadius: 4,
  flexGrow: 1,
  position: 'relative',
} as const

export default PopupDialog
