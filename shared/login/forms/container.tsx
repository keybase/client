import type {Props} from './container.shared'
import * as Kb from '@/common-adapters'

const Container = ({children, style, outerStyle}: Props) => {
  if (!Kb.Styles.isMobile) {
    return (
      <div style={Kb.Styles.castStyleDesktop({...styles.container, ...outerStyle})}>
        <div style={Kb.Styles.castStyleDesktop({...styles.innerContainer, ...style})}>{children}</div>
      </div>
    )
  }
  return (
    <Kb.ScrollView style={{...styles.container, ...outerStyle}}>
      <Kb.Box2 direction="vertical" fullWidth={true} flex={1} style={{...styles.innerContainer, ...style}}>
        {children}
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
    },
    isElectron: {
      alignItems: 'flex-start',
      flex: 1,
      justifyContent: 'flex-start',
      padding: 64,
    },
    isMobile: {
      flexGrow: 1,
      paddingLeft: Kb.Styles.globalMargins.medium,
      paddingRight: Kb.Styles.globalMargins.medium,
    },
  }),
  innerContainer: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignSelf: 'stretch',
      height: '100%',
      width: '100%',
    },
    isMobile: {
      marginTop: Kb.Styles.globalMargins.medium,
    },
  }),
}))

export default Container
