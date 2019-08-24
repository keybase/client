import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Header from './header'

type Props = {
  onBack?: (() => void) | null
  onClose: () => void
  children: React.ReactNode
  isRequest: boolean
  showCancelInsteadOfBackOnMobile: boolean
}

const PoweredByStellar = () => (
  <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.textContainer}>
    <Kb.Text type="BodySmallSemibold" style={styles.textColor}>
      Powered by{' '}
      <Kb.Text
        type="BodySmallSemiboldSecondaryLink"
        onClickURL="https://stellar.org"
        style={styles.textColor}
      >
        Stellar
      </Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const Root = (props: Props) => {
  let child = (
    <>
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Header
          isRequest={props.isRequest}
          onBack={props.onBack}
          showCancelInsteadOfBackOnMobile={props.showCancelInsteadOfBackOnMobile}
        />
        {props.children}
      </Kb.Box2>
      {!Styles.isMobile && <PoweredByStellar />}
    </>
  )
  return <Kb.MaybePopup onClose={props.onClose}>{child}</Kb.MaybePopup>
}

const styles = Styles.styleSheetCreate({
  backgroundColorBlue5: {backgroundColor: Styles.globalColors.blueLighter3},
  backgroundColorPurple: {backgroundColor: Styles.globalColors.purpleDark},
  container: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
      height: 560,
      width: 400,
    },
    isMobile: {
      backgroundColor: Styles.globalColors.white,
      flex: 1,
      maxHeight: '100%',
      width: '100%',
    },
  }),
  textColor: {
    color: Styles.globalColors.white_40,
  },
  textContainer: Styles.platformStyles({
    isElectron: {
      bottom: -26, // TODO: tweak this number, maybe make it calculated from the text's line height and a global margin
      position: 'absolute',
      textAlign: 'center',
    },
  }),
})

export default Root
