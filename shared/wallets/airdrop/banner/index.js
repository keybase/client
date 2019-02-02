// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  headerBody: string,
  onCheckQualify: () => void,
  onCancel: () => void,
  show: boolean,
|}

const Banner = (p: Props) => {
  if (!p.show) return null

  const join = (
    <Kb.Button
      type="PrimaryColoredBackground"
      backgroundMode="Purple"
      label="Join the airdrop"
      onClick={p.onCheckQualify}
      style={styles.button}
      small={true}
    />
  )

  const textAndButtons = Styles.isMobile ? (
    <Kb.Box2 direction="horizontal" style={styles.grow}>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Markdown styleOverride={markdownOverride} style={styles.markdown}>
          {p.headerBody}
        </Kb.Markdown>
        <Kb.Box2 direction="horizontal" gap="tiny" style={styles.buttonContainer}>
          {join}
          <Kb.Button
            type="SecondaryColoredBackground"
            backgroundMode="Purple"
            style={styles.laterButton}
            label="Later"
            onClick={p.onCancel}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  ) : (
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
  paragraph: {
    color: Styles.globalColors.white,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: `16px`,
  },
  strong: {...Styles.globalStyles.fontExtrabold},
}

const styles = Styles.styleSheetCreate({
  button: {marginTop: Styles.isMobile ? Styles.globalMargins.small : 0},
  buttonContainer: {flexWrap: 'wrap'},
  close: {padding: Styles.globalMargins.xxtiny},
  container: {
    backgroundColor: Styles.globalColors.purple2,
    padding: Styles.globalMargins.tiny,
  },
  grow: {flexGrow: 1, flexShrink: 1},
  laterButton: {marginTop: Styles.isMobile ? Styles.globalMargins.small : 0},
  markdown: {alignSelf: 'center'},
  textContainer: {
    flexGrow: 1,
    flexShrink: 1,
  },
})

export default Banner
