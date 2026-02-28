import type {Props} from './container'
import * as Kb from '@/common-adapters'
import NativeScrollView from '@/common-adapters/scroll-view.native'

const Container = ({children, style, outerStyle}: Props) => {
  return (
    <NativeScrollView style={{...styles.container, ...outerStyle}}>
      <Kb.Box style={{...styles.innerContainer, ...style}}>{children}</Kb.Box>
    </NativeScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        flexGrow: 1,
        paddingLeft: Kb.Styles.globalMargins.medium,
        paddingRight: Kb.Styles.globalMargins.medium,
      },
      innerContainer: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        flexGrow: 1,
        marginTop: Kb.Styles.globalMargins.medium,
      },
    }) as const
)

export default Container
