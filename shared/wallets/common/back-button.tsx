import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  showCancelInsteadOfBackOnMobile: boolean
  onBack: () => void
  isOnWhiteBackground?: boolean
}

const WalletBackButton = (props: Props) =>
  Styles.isMobile ? (
    <Kb.Text
      onClick={props.onBack}
      style={Styles.collapseStyles([styles.backButton, !props.isOnWhiteBackground && styles.whiteText])}
      type="BodyPrimaryLink"
    >
      {props.showCancelInsteadOfBackOnMobile ? 'Cancel' : 'Back'}
    </Kb.Text>
  ) : (
    <Kb.BackButton
      onClick={props.onBack}
      style={styles.backButton}
      iconColor={props.isOnWhiteBackground ? undefined : Styles.globalColors.white}
      textStyle={props.isOnWhiteBackground ? undefined : styles.whiteText}
    />
  )

const styles = Styles.styleSheetCreate({
  backButton: Styles.platformStyles({
    common: {position: 'absolute'},
    isElectron: {
      left: Styles.globalMargins.small,
      top: Styles.globalMargins.small,
    },
    isMobile: {
      left: 12,
      top: 12,
    },
  }),
  whiteText: {
    color: Styles.globalColors.white,
  },
})

export default WalletBackButton
