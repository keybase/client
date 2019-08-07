import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  // path: Types.Path
}

export default (_: Props) => (
  <Kb.Box2
    direction="vertical"
    centerChildren={true}
    style={styles.container}
    fullHeight={true}
    fullWidth={true}
    gap="small"
  >
    <Kb.ProgressIndicator type="Large" />
    <Kb.Text type="BodySmall">Loading ...</Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.blueLighter3,
    ...Styles.globalStyles.flexGrow,
  },
})
