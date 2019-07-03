import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SystemButtons} from '../../../router-v2/header/index'

type Props = {
  headerBody: string
  onCheckQualify: () => void
  onCancel: () => void
  oneLine: boolean
  show: boolean
  shouldShowSystemButtons: boolean
}

const Banner = (p: Props) => {
  console.warn('in Banner', p)
  if (!p.show) return null

  console.warn('in Banner', p)
  const join = (
    <Kb.Button
      backgroundColor="purple"
      label="Join the airdrop"
      onClick={p.onCheckQualify}
      small={true}
      style={styles.button}
    />
  )

  const textAndButtonsOneline = (
    <Kb.Box2
      direction="horizontal"
      style={styles.grow}
      centerChildren={true}
      alignItems="flex-start"
      gap="small"
    >
      <Kb.Markdown styleOverride={markdownOverride} style={styles.markdown}>
        {p.headerBody}
      </Kb.Markdown>
      {join}
      <Kb.Box2 direction="vertical" style={styles.grow} />
      <Kb.Icon type="iconfont-close" onClick={p.onCancel} style={styles.close} />
    </Kb.Box2>
  )

  const textAndButtonsTwolines = (
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
      {p.shouldShowSystemButtons && (
        <Kb.Box2 direction="horizontal" style={{alignSelf: 'flex-start'}}>
          <SystemButtons />
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  return (
    <Kb.Box2 noShrink={true} fullWidth={true} direction="horizontal" style={styles.container} gap="xsmall">
      <Kb.Box2 direction="horizontal" centerChildren={true} alignSelf="flex-start">
        <Kb.Icon type="icon-airdrop-star-32" />
      </Kb.Box2>
      {p.shouldShowSystemButtons
        ? textAndButtonsTwolines
        : p.oneLine
        ? textAndButtonsOneline
        : textAndButtonsTwolines}
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
  button: Styles.platformStyles({
    isElectron: Styles.desktopStyles.windowDraggingClickable,
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
    isElectron: {alignSelf: 'flex-start', paddingBottom: Styles.globalMargins.tiny, maxWidth: 400},
    isMobile: {alignSelf: 'center'},
  }),
  textContainer: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

export default Banner
