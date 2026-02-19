import * as Kb from '@/common-adapters'
import type {Props} from './you-rekey'

const YouRekey = ({onRekey}: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={{
          backgroundColor: Kb.Styles.globalColors.red,
          justifyContent: 'center',
        }}
      >
        <Kb.Text3
          negative={true}
          style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
          type="BodySemibold"
        >
          This conversation needs to be rekeyed.
        </Kb.Text3>
      </Kb.Box2>
      <Kb.ButtonBar>
        <Kb.Button backgroundColor="blue" onClick={onRekey} label="Rekey" />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.blueDarker2,
        flex: 1,
        justifyContent: 'flex-start',
      },
    }) as const
)

export default YouRekey
