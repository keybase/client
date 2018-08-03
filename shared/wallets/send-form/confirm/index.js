// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
// import Body from '../body/container'
import Header from '../header'

type ConfirmSendProps = {|
  onClose: () => void,
  onBack: () => void,
|}

export default function ConfirmSend(props: ConfirmSendProps) {
  return (
    <Kb.MaybePopup onClose={props.onClose}>
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Header onBack={props.onBack} />
        {/* <Body bannerInfo={props.bannerInfo} isProcessing={props.isProcessing} onClick={props.onClick} /> */}
      </Kb.Box2>
    </Kb.MaybePopup>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
    },
  }),
})
