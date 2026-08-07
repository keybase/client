import * as Kb from '@/common-adapters'

const OpenMeta = ({isOpen}: {isOpen: boolean}) => {
  const styles = useStyles()
  return isOpen ? <Kb.Meta variant="open" style={styles.meta} /> : null
}

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      meta: {alignSelf: 'center'},
    }) as const
)

export default OpenMeta
