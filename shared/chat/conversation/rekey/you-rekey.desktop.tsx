import * as Kb from '@/common-adapters'
import type {Props} from './you-rekey'

const YouRekey = ({onRekey}: Props) => {
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box
        style={{
          ...Kb.Styles.globalStyles.flexBoxRow,
          backgroundColor: Kb.Styles.globalColors.red,
          justifyContent: 'center',
        }}
      >
        <Kb.Text
          negative={true}
          style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
          type="BodySemibold"
        >
          This conversation needs to be rekeyed.
        </Kb.Text>
      </Kb.Box>
      <Kb.ButtonBar>
        <Kb.Button backgroundColor="blue" onClick={onRekey} label="Rekey" />
      </Kb.ButtonBar>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        backgroundColor: Kb.Styles.globalColors.blueDarker2,
        flex: 1,
        justifyContent: 'flex-start',
      },
    }) as const
)

export default YouRekey
