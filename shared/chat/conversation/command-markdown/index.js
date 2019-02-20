// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  text: string,
|}

const styleOverride = {
  fence: {
    backgroundColor: Styles.isMobile ? null : Styles.globalColors.lightGrey,
  },
}

const CommandMarkdown = (props: Props) => {
  return (
    <Kb.ScrollView style={styles.scrollContainer}>
      <Kb.Box2 direction="vertical" style={styles.textContainer}>
        <Kb.Markdown styleOverride={styleOverride}>{props.text}</Kb.Markdown>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate({
  scrollContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      backgroundColor: Styles.globalColors.lightGrey,
      borderRadius: Styles.borderRadius,
      marginLeft: 15,
      marginRight: 15,
      maxHeight: 300,
    },
    isMobile: {
      borderColor: Styles.globalColors.black_10,
      borderStyle: 'solid',
      borderTopWidth: 3,
      maxHeight: 200,
    },
  }),
  textContainer: {
    padding: Styles.globalMargins.tiny,
  },
})

export default CommandMarkdown
