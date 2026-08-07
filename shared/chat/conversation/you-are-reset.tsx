import * as Kb from '@/common-adapters'

const YouAreReset = () => {
  const styles = useStyles()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} flex={1}>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} flex={1}>
        <Kb.ImageIcon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" alignItems="center" padding="small" fullWidth={true} style={styles.box}>
        <Kb.Text type="BodySemibold" negative={true} center={true}>
          Since you reset your account, participants have to accept to let you back in.
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      box: {
        backgroundColor: theme.red,
      },
    }) as const
)

export default YouAreReset
