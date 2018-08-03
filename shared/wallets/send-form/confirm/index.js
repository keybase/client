// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
// import Body from '../body/container'
// import Header from '../header'
import Memo from '../memo/container'
// import Note from '../note/container'
import Participants from '../participants/container'

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
        <Participants />
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
            onClick={() => {}}
            disabled={false}
            fullWidth={true}
            style={styles.button}
            children={
              <React.Fragment>
                <Kb.Icon
                  type="iconfont-stellar-send"
                  style={Kb.iconCastPlatformStyles(styles.icon)}
                  color={Styles.globalColors.white}
                />
                <Kb.Text type="BodySemibold" style={styles.buttonText}>
                  Send{' '}
                  <Kb.Text type="BodyExtrabold" style={styles.buttonText}>
                    {props.amount}
                  </Kb.Text>
                </Kb.Text>
              </React.Fragment>
            }
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.MaybePopup>
  )
}

const styles = Styles.styleSheetCreate({
  icon: {
    marginRight: Styles.globalMargins.tiny,
  },
  buttonText: {color: Styles.globalColors.white},
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
