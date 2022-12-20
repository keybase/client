import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {Props} from './you-rekey'

const YouRekey = ({onRekey}: Props) => {
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxRow,
          backgroundColor: Styles.globalColors.red,
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        backgroundColor: Styles.globalColors.blueDarker2,
        flex: 1,
        justifyContent: 'flex-start',
      },
    } as const)
)

export default YouRekey
