import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  headerBody: string
  onCheckQualify: () => void
  onCancel: () => void
  show: boolean
}

const Banner = (p: Props) => {
  console.warn('in Banner', p)
  if (!p.show) return null

  console.warn('in Banner', p)
  const join = (
    <Kb.Button backgroundColor="purple" label="Join the airdrop" onClick={p.onCheckQualify} small={true} />
  )

  const textAndButtons = (
    <Kb.Box2 direction="horizontal" style={styles.grow}>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Markdown styleOverride={markdownOverride} style={styles.markdown}>
          {p.headerBody}
        </Kb.Markdown>
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.buttonContainer}>
          {join}
          <Kb.Button
            mode="Secondary"
            backgroundColor="purple"
            label="Later"
            onClick={p.onCancel}
            small={true}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )

  return (
    <Kb.Box2 noShrink={true} fullWidth={true} direction="horizontal" style={styles.container} gap="xsmall">
      <Kb.Box2 direction="horizontal" centerChildren={true} alignSelf="flex-start">
        <Kb.Icon type="icon-airdrop-star-32" />
      </Kb.Box2>
      {textAndButtons}
    </Kb.Box2>
  )
}

const markdownOverride = {
  paragraph: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      fontWeight: '600',
    },
    isElectron: {fontSize: 12, lineHeight: '16px'},
    isMobile: {fontSize: 14, lineHeight: 19},
  }),
  strong: {...Styles.globalStyles.fontExtrabold},
}

const styles = Styles.styleSheetCreate({
  buttonContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      flexWrap: 'wrap',
    },
    isMobile: {
      marginBottom: Styles.globalMargins.xtiny,
      marginTop: Styles.globalMargins.tiny,
    },
  }),
  close: {padding: Styles.globalMargins.xxtiny},
  container: {
    backgroundColor: Styles.globalColors.purple,
    padding: Styles.globalMargins.tiny,
  },
  grow: {flexGrow: 1, flexShrink: 1},
  markdown: Styles.platformStyles({
    isElectron: {alignSelf: 'flex-start', paddingBottom: Styles.globalMargins.tiny, width: 400},
    isMobile: {alignSelf: 'center'},
  }),
  textContainer: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

export default Banner
