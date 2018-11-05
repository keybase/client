// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type EnterKeyProps = {|
  error: string,
  onKeyChange: string => void,
  secretKey: string,
|}

const EnterKey = (props: EnterKeyProps) => (
  <>
    <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
      {!Styles.isMobile && (
        <>
          <Kb.Icon type="icon-wallet-add-48" style={Kb.iconCastPlatformStyles(styles.icon)} />
          <Kb.Text type="Header" style={styles.headerText}>
            Link an existing account
          </Kb.Text>
        </>
      )}
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.blue}}>
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
          autoFocus={true}
        />
        {!!props.error && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {props.error}
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.InfoNote containerStyle={styles.infoNote}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySmall" lineClamp={1} style={styles.textCenter}>
            Example:
            <Kb.Text type="BodySmall" lineClamp={1} ellipsizeMode="middle">
              SDNBUWJ34218239OAOPAMBCLDLSNBSC7632
            </Kb.Text>
          </Kb.Text>
          <Kb.Text type="BodySmall" style={styles.textCenter}>
            This imports a Stellar secret key so you can also use it in Keybase. You can continue to use this
            Stellar account in other wallet apps.
          </Kb.Text>
        </Kb.Box2>
      </Kb.InfoNote>
    </Kb.Box2>
  </>
)

const styles = Styles.styleSheetCreate({
  icon: {
    width: 48,
    height: 48,
  },
  headerText: {
    marginTop: Styles.globalMargins.medium,
    marginBottom: Styles.globalMargins.medium,
  },
  error: Styles.platformStyles({
    common: {
      color: Styles.globalColors.red,
      textAlign: 'left',
      width: '100%',
    },
    isElectron: {
      wordWrap: 'break-word',
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
  infoNote: {
    marginTop: Styles.globalMargins.medium,
  },
  textCenter: {textAlign: 'center'},
})

export default EnterKey
