import * as Kb from '@/common-adapters'
import type {Props} from './you-rekey'

const YouRekey = ({onEnterPaperkey}: Props) => (
  <Kb.Box2 direction="vertical">
    <Kb.Banner color="red">
      <Kb.BannerParagraph bannerColor="red" content="This conversation needs to be rekeyed." />
    </Kb.Banner>
    <Kb.Box style={styles.container}>
      <Kb.Box
        style={{
          ...Kb.Styles.globalStyles.flexBoxColumn,
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'stretch',
        flex: 1,
        justifyContent: 'flex-start',
        padding: Kb.Styles.globalMargins.small,
      },
      text: {
        marginBottom: Kb.Styles.globalMargins.large,
        marginTop: Kb.Styles.globalMargins.large,
      },
    }) as const
)

export default YouRekey
