import type {Props} from './container'
import * as Kb from '@/common-adapters'

const Container = ({children, style, outerStyle}: Props) => {
  return (
    <div style={Kb.Styles.castStyleDesktop({...styles.container, ...outerStyle})}>
      <div style={Kb.Styles.castStyleDesktop({...styles.innerContainer, ...style})}>{children}</div>
    </div>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        flex: 1,
        justifyContent: 'flex-start',
        padding: 64,
      },
      innerContainer: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignSelf: 'stretch',
        height: '100%',
        width: '100%',
      },
    }) as const
)
export default Container
