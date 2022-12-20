import * as Styles from '../../styles'
import type {Props} from './container'
import {Box, NativeScrollView} from '../../common-adapters/mobile.native'

const Container = ({children, style, outerStyle}: Props) => {
  return (
    <NativeScrollView style={{...styles.container, ...outerStyle}}>
      <Box style={{...styles.innerContainer, ...style}}>{children}</Box>
    </NativeScrollView>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        flexGrow: 1,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
      },
      innerContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        flexGrow: 1,
        marginTop: Styles.globalMargins.medium,
      },
    } as const)
)

export default Container
