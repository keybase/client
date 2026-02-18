import {Box2} from './box'
import {TouchableWithoutFeedback} from 'react-native'
import * as Styles from '@/styles'

import type {Props} from './popup-dialog'

export function PopupDialog({children, onClose, styleCover, styleContainer}: Props) {
  return (
    <TouchableWithoutFeedback onPress={onClose || undefined}>
      <Box2 direction="vertical" centerChildren={true} style={Styles.collapseStyles([styles.cover, styleCover])}>
        <TouchableWithoutFeedback>
          <Box2 direction="vertical" style={Styles.collapseStyles([styles.container, styleContainer])}>
            {children}
          </Box2>
        </TouchableWithoutFeedback>
      </Box2>
    </TouchableWithoutFeedback>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Styles.globalColors.white,
        borderRadius: 4,
        flexGrow: 1,
        position: 'relative',
      },
      cover: {
        ...Styles.globalStyles.fillAbsolute,
        backgroundColor: Styles.globalColors.black,
        paddingBottom: Styles.globalMargins.small,
        paddingLeft: Styles.globalMargins.large,
        paddingRight: Styles.globalMargins.large,
        paddingTop: Styles.globalMargins.small,
      },
    }) as const
)

export default PopupDialog
