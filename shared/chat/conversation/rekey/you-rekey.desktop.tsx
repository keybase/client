import * as Kb from '@/common-adapters'
import type {Props} from './you-rekey'

const YouRekey = ({onRekey}: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} justifyContent="flex-start" flex={1} style={styles.container}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        justifyContent="center"
        style={{
          backgroundColor: Kb.Styles.globalColors.red,
        }}
      >
        <Kb.Text
          negative={true}
          style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
          type="BodySemibold"
        >
          This conversation needs to be rekeyed.
        </Kb.Text>
      </Kb.Box2>
      <Kb.ButtonBar>
        <Kb.Button onClick={onRekey} label="Rekey" style={styles.primaryOnBlue} labelStyle={styles.primaryOnBlueLabel} />
      </Kb.ButtonBar>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.blueDarker2,
      },
      primaryOnBlue: {backgroundColor: Kb.Styles.globalColors.white},
      primaryOnBlueLabel: {color: Kb.Styles.globalColors.blueDark},
    }) as const
)

export default YouRekey
