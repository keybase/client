// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Header from './header'

type Props = {|
  onClose: () => void,
  children: React.Node,
|}

const PoweredByStellar = () => (
  <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.textContainer}>
    <Kb.Text type="BodySmallSemibold" style={styles.textColor}>
      Powered by{' '}
      <Kb.Text
        type="BodySmallSemiboldSecondaryLink"
        isLink={true}
        onClickURL="https://stellar.org"
        style={styles.textColor}
      >
        stellar
      </Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const RootNoSafeArea = (props: Props) => (
  <>
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Header onBack={Styles.isMobile ? props.onClose : null} />
      {props.children}
    </Kb.Box2>
    {!Styles.isMobile && <PoweredByStellar />}
  </>
)
const Root = (props: Props) => (
  <Kb.MaybePopup onClose={props.onClose}>
    {Styles.isMobile ? (
      <Kb.SafeAreaView style={styles.safeAreaView}>
        <RootNoSafeArea {...props} />
        {/* This box is to show a different color on the bottom than on the top */}
        <Kb.Box style={styles.safeAreaViewBottom} />
      </Kb.SafeAreaView>
    ) : (
      <RootNoSafeArea {...props} />
    )}
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
      height: 525,
      width: 360,
    },
    isMobile: {
      backgroundColor: Styles.globalColors.white,
      flexGrow: 1,
      flexShrink: 1,
      maxHeight: '100%',
      width: '100%',
    },
  }),
  safeAreaView: {backgroundColor: Styles.globalColors.purple, flex: 1},
  safeAreaViewBottom: {
    backgroundColor: Styles.globalColors.blue5,
    bottom: 0,
    height: 100,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: -1000,
  },
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
