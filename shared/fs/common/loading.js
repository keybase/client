// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'

type Props = {
  path: Types.Path,
}

export default ({path}: Props) => (
  <Kb.Box2
    direction="vertical"
    centerChildren={true}
    style={styles.container}
    fullHeight={true}
    fullWidth={true}
    gap="small"
  >
    <Kb.ProgressIndicator style={styles.indicator} />
    <Kb.Text type="Body">Loading {Types.pathToString(path)} ...</Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.blue5,
  },
  indicator: {
    height: 32,
    width: 32,
  },
})
