import * as Kb from '../../../common-adapters/mobile.native'
import * as Styles from '../../../styles'
import type {Props} from './you-rekey'

const YouRekey = ({onEnterPaperkey}: Props) => (
  <Kb.Box2 direction="vertical">
    <Kb.Banner color="red">
      <Kb.BannerParagraph bannerColor="red" content="This conversation needs to be rekeyed." />
    </Kb.Banner>
    <Kb.Box style={styles.container}>
      <Kb.Box
        style={{
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Kb.Text center={true} type="BodySmall" style={styles.text} negative={true}>
          To unlock this conversation, open one of your other devices or enter a paperkey.
        </Kb.Text>
        <Kb.Button onClick={onEnterPaperkey} label="Enter a paper key" />
      </Kb.Box>
    </Kb.Box>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        flex: 1,
        justifyContent: 'flex-start',
        padding: Styles.globalMargins.small,
      },
      text: {
        marginBottom: Styles.globalMargins.large,
        marginTop: Styles.globalMargins.large,
      },
    } as const)
)

export default YouRekey
