// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import WalletPopup from '../wallet-popup'

type EnterNameProps = {
  error?: string,
  name: string,
  onBack?: () => void,
  onClose: () => void,
  onNameChange: string => void,
  onDone: () => void,
  waiting: boolean,
}

// const EnterName = (props: EnterNameProps) => (
//   <Kb.Box2 direction="vertical" style={styles.popupContainer}>
//     <Kb.HeaderHocHeader onBack={props.onBack} headerStyle={styles.header} />
//     <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
//       <Kb.Box2
//         direction="vertical"
//         gap="medium"
//         fullWidth={true}
//         fullHeight={true}
//         style={styles.contentContainer}
//       >
//
//       </Kb.Box2>
//       <Kb.ButtonBar>
//
//       </Kb.ButtonBar>
//     </Kb.Box2>
//   </Kb.Box2>
// )

const EnterName = (props: EnterNameProps) => {
  const buttons = [
    <Kb.Button key={0} type="Secondary" onClick={props.onClose} label="Cancel" />,
    <Kb.Button key={1} type="Wallet" onClick={props.onDone} label="Done" waiting={props.waiting} />,
  ]
  return (
    <WalletPopup bottomButtons={buttons} onClose={props.onClose}>
      <Kb.Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
      <Kb.Text type="Header">Name your account</Kb.Text>
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Kb.Text type="BodySmall" style={{color: Styles.globalColors.blue}}>
          Account name
        </Kb.Text>
        <Kb.Input
          hideLabel={true}
          hideUnderline={true}
          inputStyle={Styles.collapseStyles([styles.inputElement, styles.tallSingleLineInput])}
          style={styles.input}
          value={props.name}
          onChangeText={props.onNameChange}
        />
        {props.error && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {props.error}
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.InfoNote>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySmall" style={styles.textCenter}>
            Your account name is encrypted and only visible to you.
          </Kb.Text>
        </Kb.Box2>
      </Kb.InfoNote>
    </WalletPopup>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    padding: Styles.globalMargins.medium,
  },
  contentContainer: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flex: 1,
  },
  error: Styles.platformStyles({
    common: {
      color: Styles.globalColors.red,
      width: '100%',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),
  header: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
    },
  }),
  input: Styles.platformStyles({common: {margin: 0}, isElectron: {width: '100%'}}),
  inputContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-start',
    },
    isElectron: {width: '100%'},
  }),
  inputElement: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      padding: Styles.globalMargins.xtiny,
      textAlign: 'left',
    },
    isElectron: {
      minWidth: 0,
      width: '100%',
    },
    isMobile: {
      minWidth: '100%',
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
    },
  }),
  popupContainer: {
    height: 525,
    width: 360,
  },
  tallSingleLineInput: Styles.platformStyles({
    isMobile: {
      minHeight: 32,
      paddingBottom: 0,
      paddingTop: 0,
    },
  }),
  textCenter: {textAlign: 'center'},
})

export default EnterName
