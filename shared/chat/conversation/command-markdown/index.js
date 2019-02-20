// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  text: string,
|}

const CommandMarkdown = (props: Props) => {
  return (
    <Kb.ScrollView style={styles.scrollContainer}>
      <Kb.Box2 direction="vertical" style={styles.textContainer}>
        <Kb.Markdown>{props.text}</Kb.Markdown>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate({
  scrollContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      borderRadius: Styles.borderRadius,
      marginLeft: 15,
      marginRight: 15,
      maxHeight: 300,
    },
  }),
  textContainer: {
    padding: Styles.globalMargins.tiny,
  },
})

export default CommandMarkdown
