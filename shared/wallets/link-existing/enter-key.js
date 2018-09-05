// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type EnterKeyProps = {
  error: string,
  onCancel: () => void,
  onKeyChange: string => void,
  onNext: () => void,
  secretKey: string,
  waiting: boolean,
}

const EnterKey = (props: EnterKeyProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    fullHeight={true}
    style={Styles.collapseStyles([styles.popupContainer, styles.container])}
  >
    <Kb.Box2
      direction="vertical"
      gap="medium"
      fullWidth={true}
      fullHeight={true}
      style={styles.contentContainer}
    >
      <Kb.Icon type="icon-wallet-add-48" style={{width: 48, height: 48}} />
      <Kb.Text type="Header">Link an existing account</Kb.Text>
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Kb.Text type="BodySmall" style={{color: Styles.globalColors.blue}}>
          Paste your secret key
        </Kb.Text>
        <Kb.Input
          hideLabel={true}
          multiline={true}
          rowsMin={2}
          rowsMax={2}
          hideUnderline={true}
          inputStyle={styles.inputElement}
          style={styles.input}
          onChangeText={props.onKeyChange}
          value={props.secretKey}
        />
        {props.error && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {props.error}
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.InfoNote>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Box2 direction="horizontal" gap="xtiny">
            <Kb.Text type="BodySmall" lineClamp={1} style={styles.textCenter}>
              Example:
            </Kb.Text>
            <Kb.Text type="BodySmall" lineClamp={1} ellipsizeMode="middle">
              SDNBUWJ34218239OAOPAMBCLDLSNBSC7632
            </Kb.Text>
          </Kb.Box2>
          <Kb.Text type="BodySmall" style={styles.textCenter}>
            This imports a Stellar secret key so you can also use it in Keybase. You can continue to use this
            Stellar account in other wallet apps.
          </Kb.Text>
        </Kb.Box2>
      </Kb.InfoNote>
    </Kb.Box2>
    <Kb.ButtonBar>
      <Kb.Button type="Secondary" onClick={props.onCancel} label="Cancel" />
      <Kb.Button type="Wallet" onClick={props.onNext} label="Next" waiting={props.waiting} />
    </Kb.ButtonBar>
  </Kb.Box2>
)

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

export default EnterKey
