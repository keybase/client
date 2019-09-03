import * as React from 'react'
import * as Kb from '../../../common-adapters/index'
import * as Styles from '../../../styles'

export default () => (
  <Kb.Box2 direction="vertical" gap="xtiny" style={styles.wonderlandStyle}>
    <Kb.Text type="BodySmall" center={true} selectable={true} style={styles.wonderlandTextStyle}>
      {'How long is forever?'}
      {'\n'}
      {'Sometimes, just one second.'}
    </Kb.Text>
    <Kb.Text type="Body" center={true} selectable={true}>
      <Kb.Emoji size={16} emojiName=":clock12:" />
      <Kb.Emoji size={16} emojiName=":rose:" />
      <Kb.Emoji size={16} emojiName=":black_joker:" />
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  wonderlandStyle: {
    ...Styles.globalStyles.flexBoxCenter,
    height: '100%',
  },
  wonderlandTextStyle: Styles.platformStyles({
    isElectron: {
      whiteSpace: 'pre-line',
    },
  }),
}))
