import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Platform from '../../../constants/platform'
import * as Styles from '../../../styles'
import {SystemButtons} from '../../../router-v2/header/index'

type Props = {
  headerBody: string
  onCheckQualify: () => void
  onCancel: () => void
  show: boolean
  showSystemButtons: boolean
}

const Banner = (p: Props) => {
  if (!p.show) return null

  const join = (
    <Kb.Button
      backgroundColor="purple"
      label="Join the airdrop"
      onClick={p.onCheckQualify}
      small={true}
      style={styles.button}
    />
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
            style={styles.button}
          />
        </Kb.Box2>
      </Kb.Box2>
      {p.showSystemButtons && (
        <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <SystemButtons />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  return (
    <Kb.Box2 noShrink={true} fullWidth={true} direction="horizontal" style={styles.container} gap="xsmall">
      <Kb.Box2 direction="horizontal" centerChildren={true} alignSelf="flex-start">
        <Kb.Icon type="icon-airdrop-logo-32" />
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
    isElectron: {fontSize: 13, lineHeight: '17px'},
    isMobile: {fontSize: 14, lineHeight: 18},
  }),
  strong: Styles.platformStyles({
    common: Styles.globalStyles.fontExtrabold,
    isElectron: {fontSize: 13, lineHeight: '17px'},
    isMobile: {fontSize: 14, lineHeight: 18},
  }),
}

const styles = Styles.styleSheetCreate({
  button: Styles.platformStyles({
    isElectron: Styles.desktopStyles.windowDraggingClickable,
  }),
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
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purple,
      padding: Styles.globalMargins.tiny,
    },
    isElectron: Styles.desktopStyles.windowDragging,
  }),
  grow: {flexGrow: 1, flexShrink: 1},
  markdown: Styles.platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      maxWidth: Platform.isMac ? undefined : 400,
      paddingBottom: Styles.globalMargins.tiny,
    },
    isMobile: {alignSelf: 'center'},
  }),
  textContainer: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

export default Banner
