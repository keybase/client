// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
// import Body from '../body/container'
// import Header from '../header'
import Memo from '../memo/container'
// import Note from '../note/container'

type ConfirmSendProps = {|
  onClose: () => void,
  onBack: () => void,
  amount: string,
  // onClick: () => void,
|}

export default function ConfirmSend(props: ConfirmSendProps) {
  return (
    <Kb.MaybePopup onClose={props.onClose}>
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header} />
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          to/from
        </Kb.Box2>
        <Memo />
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          centerChildren={true}
          gap="small"
          gapStart={true}
          gapEnd={true}
          style={styles.buttonContainer}
        >
          <Kb.Button
            type="PrimaryGreen"
            label={`Send ${props.amount}`}
            onClick={() => {}}
            disabled={false}
            fullWidth={true}
            style={styles.button}
            children={
              <Kb.Icon
                type="iconfont-stellar-send"
                style={Kb.iconCastPlatformStyles(styles.icon)}
                color={Styles.globalColors.white}
              />
            }
          />
        </Kb.Box2>
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
  header: Styles.platformStyles({
    isElectron: {
      height: 144,
      flex: 1,
      backgroundColor: Styles.globalColors.purple,
    },
  }),
  buttonContainer: Styles.platformStyles({
    isElectron: {
      borderTopStyle: 'solid',
      borderTopWidth: 1,
      borderTopColor: Styles.globalColors.black_05,
      height: 72.5,
    },
  }),
})
