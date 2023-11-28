import * as Kb from '@/common-adapters'

const sentence1 = 'Channels can be joined by anyone, unlike subteams.'
const sentence2 = 'Anyone except readers can create channels.'
const ChannelRow = () => (
  <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.container}>
    <Kb.InfoNote>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySmall" center={true} style={styles.text}>
          {sentence1} {Kb.Styles.isMobile && sentence2}
        </Kb.Text>
        {!Kb.Styles.isMobile && (
          <Kb.Text type="BodySmall" center={true} style={styles.text}>
            {sentence2}
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.InfoNote>
  </Kb.Box2>
)
export default ChannelRow

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.large, Kb.Styles.globalMargins.medium),
    backgroundColor: Kb.Styles.globalColors.blueGrey,
  },
  text: {
    maxWidth: 326,
  },
}))
