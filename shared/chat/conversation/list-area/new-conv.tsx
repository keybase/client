import * as React from 'react'
import * as Kb from '../../../common-adapters/index'
import * as Styles from '../../../styles'

export default () => (
  <Kb.Box style={styles.wonderlandStyle}>
    <Kb.Text type="BodySemibold" center={true} style={styles.wonderlandTextStyle}>
      {'How long is forever?'}
      {'\n'}
      {'Sometimes, just one second.'}
      {'\n'}
      {'⏱️🌹🃏'}
    </Kb.Text>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(() => ({
  wonderlandStyle: {
    ...Styles.globalStyles.flexBoxCenter,
    height: 116,
  },
  wonderlandTextStyle: Styles.platformStyles({
    common: {
      color: Styles.globalColors.black_50,
    },
    isElectron: {
      whiteSpace: 'pre-line',
    },
  }),
}))
