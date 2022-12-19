import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

const sentence1 = 'Channels can be joined by anyone, unlike subteams.'
const sentence2 = 'Anyone except readers can create channels.'
const ChannelRow = () => (
  <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.container}>
    <Kb.InfoNote>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySmall" center={true} style={styles.text}>
          {sentence1} {Styles.isMobile && sentence2}
        </Kb.Text>
        {!Styles.isMobile && (
          <Kb.Text type="BodySmall" center={true} style={styles.text}>
            {sentence2}
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.InfoNote>
  </Kb.Box2>
)
export default ChannelRow

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.large, Styles.globalMargins.medium),
    backgroundColor: Styles.globalColors.blueGrey,
  },
  text: {
    maxWidth: 326,
  },
}))
