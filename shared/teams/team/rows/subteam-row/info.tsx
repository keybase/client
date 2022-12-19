import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'

const SubteamRow = () => (
  <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.container}>
    <Kb.InfoNote>
      <Kb.Text type="BodySmall" center={true} style={styles.text}>
        Use subteams to create private groups within your team or to invite outside collaborators.
      </Kb.Text>
    </Kb.InfoNote>
  </Kb.Box2>
)
export default SubteamRow

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.large, Styles.globalMargins.medium),
    backgroundColor: Styles.globalColors.blueGrey,
  },
  text: {
    maxWidth: 326,
  },
}))
