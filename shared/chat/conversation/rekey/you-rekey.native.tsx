import * as Kb from '@/common-adapters'
import type {Props} from './you-rekey'

const YouRekey = ({onEnterPaperkey}: Props) => (
  <Kb.Box2 direction="vertical">
    <Kb.Banner color="red">
      <Kb.BannerParagraph bannerColor="red" content="This conversation needs to be rekeyed." />
    </Kb.Banner>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={{
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <Kb.Text3 center={true} type="BodySmall" style={styles.text} negative={true}>
          To unlock this conversation, open one of your other devices or enter a paperkey.
        </Kb.Text3>
        <Kb.Button onClick={onEnterPaperkey} label="Enter a paper key" />
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
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
