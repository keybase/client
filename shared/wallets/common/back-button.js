// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  onBack: () => void,
}

const WalletBackButton = (props: Props) =>
  Styles.isMobile ? (
    <Kb.Text onClick={props.onBack} style={styles.backButton} textStyle={styles.backButtonText} type="Header">
      Cancel
    </Kb.Text>
  ) : (
    <Kb.BackButton
      onClick={props.onBack}
      style={styles.backButton}
      iconColor={Styles.globalColors.white}
      textStyle={styles.backButtonText}
    />
  )

const styles = Styles.styleSheetCreate({
  backButton: Styles.platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      left: Styles.globalMargins.small,
      top: Styles.globalMargins.small,
    },
    isMobile: {
      color: Styles.globalColors.white,
      left: 12,
      top: 12,
    },
  }),
  backButtonText: {
    color: Styles.globalColors.white,
  },
})

export default WalletBackButton
