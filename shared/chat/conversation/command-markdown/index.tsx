import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  body: string
  title: string | null
}

const CommandMarkdown = (props: Props) => {
  return (
    <Kb.Box style={styles.container}>
      {!!props.title && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.title}>
          <Kb.Markdown>{props.title}</Kb.Markdown>
        </Kb.Box2>
      )}
      <Kb.ScrollView style={styles.scrollContainer}>
        <Kb.Box2 direction="vertical" style={styles.bodyContainer}>
          <Kb.Markdown>{props.body}</Kb.Markdown>
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate({
  bodyContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.tiny,
  },
  container: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      border: `1px solid ${Styles.globalColors.black_20}`,
      borderRadius: Styles.borderRadius,
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: Styles.globalMargins.small,
      marginRight: Styles.globalMargins.small,
    },
    isMobile: {
      backgroundColor: Styles.globalColors.white,
    },
  }),
  scrollContainer: Styles.platformStyles({
    isElectron: {
      maxHeight: 300,
    },
  }),
  title: {
    backgroundColor: Styles.globalColors.black_05,
    borderBottomWidth: 1,
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default CommandMarkdown
