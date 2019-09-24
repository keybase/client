import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type IntroProps = {
  headerBody: string
  headerTitle: string
  onClose: () => void
  onSeenIntro: () => void
}

const Intro = (props: IntroProps) => {
  return (
    <Kb.Modal
      mobileStyle={styles.background}
      header={
        Styles.isMobile
          ? {
              leftButton: (
                <Kb.Button
                  key={0}
                  type="Dim"
                  mode="Primary"
                  small={true}
                  label="Close"
                  onClick={props.onClose}
                  style={styles.closeButton}
                  labelStyle={styles.closeLabelStyle}
                />
              ),
              style: styles.background,
            }
          : undefined
      }
      footer={{
        content: (
          <Kb.ButtonBar direction="column" fullWidth={true}>
            <Kb.Button
              style={styles.buttonStyle}
              fullWidth={true}
              key={0}
              type="Dim"
              onClick={props.onSeenIntro}
              label="Open your wallet"
              labelStyle={styles.labelStyle}
            />
          </Kb.ButtonBar>
        ),
        style: styles.background,
      }}
      onClose={props.onClose}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.container}>
        <Kb.Text center={true} type="Header" style={styles.headerText}>
          {props.headerTitle || 'Keybase supports Stellar wallets.'}
        </Kb.Text>

        <Kb.Markdown styleOverride={bodyOverride} style={styles.bodyText}>
          {props.headerBody ||
            'You can now send or request Stellar Lumens to any Keybase user on *Earth*. Transactions settle in seconds, and cost a fraction of a penny.\n\nWhen sending and receiving Lumens, we automatically do the conversion in your favorite currency. We went ahead and set it to *USD*.'}
        </Kb.Markdown>

        <Kb.Icon
          color={Styles.globalColors.black}
          style={Kb.iconCastPlatformStyles(styles.illustration)}
          type="icon-illustration-stellar-payments-200-188"
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const bodyOverride = Styles.styleSheetCreate(() => ({
  paragraph: {
    color: Styles.globalColors.white,
    fontSize: Styles.isMobile ? 16 : 13,
    textAlign: Styles.isMobile ? ('center' as const) : ('left' as const),
  },
  strong: Styles.globalStyles.fontExtrabold,
}))

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: {backgroundColor: Styles.globalColors.purple},
      bodyText: {color: Styles.globalColors.white, marginBottom: Styles.globalMargins.xsmall},
      buttonStyle: {backgroundColor: Styles.globalColors.white},
      closeButton: {backgroundColor: Styles.globalColors.transparent},
      closeLabelStyle: {color: Styles.globalColors.white},
      container: {
        backgroundColor: Styles.globalColors.purple,
        paddingBottom: Styles.globalMargins.medium,
        paddingLeft: Styles.globalMargins.medium,
        paddingRight: Styles.globalMargins.medium,
        paddingTop: 0,
      },
      headerText: {
        color: Styles.globalColors.white,
        marginBottom: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.medium,
      },
      icon: {
        position: 'relative',
        top: -10,
      },
      illustration: {paddingBottom: Styles.globalMargins.mediumLarge},
      labelStyle: {color: Styles.globalColors.purpleDark},
    } as const)
)

export default Intro
