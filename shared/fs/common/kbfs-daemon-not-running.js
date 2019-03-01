// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {||}
export default (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true} gap="medium">
    <Kb.ProgressIndicator style={styles.progressIndicator} />
    <Kb.Text type="BodySmall">Waiting for KBFS service to start ...</Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  progressIndicator: {
    height: 32,
    width: 32,
  },
})
