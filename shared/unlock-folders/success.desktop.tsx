import * as Kb from '@/common-adapters'

const Success = ({onClose}: {onClose: () => void}) => (
  <Kb.Box2 direction="vertical" alignItems="center" justifyContent="space-between" style={styles.container}>
    <Kb.ImageIcon type="icon-folder-success-48" />
    <Kb.Box2 direction="vertical">
      <Kb.Text center={true} type="BodySemibold">
        Success!
      </Kb.Text>
      <Kb.Text center={true} style={styles.body} type="Body">
        Your paper key is now rekeying folders for this computer. It takes just a couple minutes but lasts
        forever, like the decision to have a child
      </Kb.Text>
    </Kb.Box2>
    <Kb.ButtonBar>
      <Kb.Button label="Okay" onClick={onClose} />
    </Kb.ButtonBar>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      body: {...Kb.Styles.paddingH(40)},
      container: {
        bottom: 30,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 40,
      },
    }) as const
)

export default Success
