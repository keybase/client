import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type IntroProps = {
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
                <Kb.Text style={styles.closeLabelStyle} type="BodyBigLink" onClick={props.onClose}>
                  Close
                </Kb.Text>
              ),
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
          Keybase now supports Stellar.
        </Kb.Text>

        <Kb.Markdown style={styles.bodyText} styleOverride={bodyOverride}>
          Stellar is built right into Keybase as a cryptographically-secure wallet. On Stellar, transactions
          settle in seconds, and they cost a fraction of a penny.
        </Kb.Markdown>

        <Kb.Icon
          color={Styles.globalColors.black}
          style={styles.illustration}
          type="icon-illustration-stellar-payments-200-188"
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}

const bodyOverride = Styles.styleSheetCreate(() => ({
  paragraph: {
    color: Styles.globalColors.white,
    fontSize: Styles.isMobile ? 16 : 14,
    fontWeight: '600',
    textAlign: Styles.isMobile ? ('center' as const) : ('left' as const),
  },
  strong: Styles.globalStyles.fontExtrabold,
}))

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: {backgroundColor: Styles.globalColors.purple},
      bodyText: {
        color: Styles.globalColors.white,
        marginBottom: Styles.globalMargins.xsmall,
        marginTop: Styles.globalMargins.small,
      },
      buttonStyle: {backgroundColor: Styles.globalColors.white},
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
      illustration: {marginTop: Styles.globalMargins.medium, paddingBottom: Styles.globalMargins.mediumLarge},
      labelStyle: {color: Styles.globalColors.purpleDark},
    } as const)
)

export default Intro
