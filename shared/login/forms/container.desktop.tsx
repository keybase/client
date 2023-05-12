import * as Styles from '../../styles'

import type {Props} from './container'

const Container = ({children, style, outerStyle}: Props) => {
  return (
    <div style={{...styles.container, ...outerStyle} as any}>
      <div style={{...styles.innerContainer, ...style} as any}>{children}</div>
    </div>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        flex: 1,
        justifyContent: 'flex-start',
        padding: 64,
      },
      innerContainer: {
        ...Styles.globalStyles.flexBoxColumn,
        alignSelf: 'stretch',
        height: '100%',
        width: '100%',
      },
    } as const)
)
export default Container
