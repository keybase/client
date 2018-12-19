// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'

type Props = {
  path: Types.Path,
}

export default ({path}: Props) => (
  <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.header} fullWidth={true}>
      <Kb.Text type="Header">Keybase Files</Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" centerChildren={true} style={styles.container} fullWidth={true} gap="small">
      <Kb.ProgressIndicator style={styles.indicator} />
      <Kb.Text type="BodySmall">Loading ...</Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.blue5,
    ...Styles.globalStyles.flexGrow,
  },
  header: {
    height: 48,
    justifyContent: 'center',
  },
  indicator: {
    height: 32,
    width: 32,
  },
})
