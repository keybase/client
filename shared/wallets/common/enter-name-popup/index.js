// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type EnterNameProps = {|
  error?: string,
  name: string,
  onNameChange: string => void,
|}

const EnterNamePopup = (props: EnterNameProps) => {
  // TODO use wallet staticConfig to keep in sync with the service
  const accountNameMaxLength = 24

  return (
    <>
      {!Styles.isMobile && (
        <>
          <Kb.Icon type="icon-wallet-add-48" style={Kb.iconCastPlatformStyles(styles.icon)} />
          <Kb.Text type="Header" style={styles.headerText}>
            Name your account
          </Kb.Text>
        </>
      )}
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.blue}}>
          Account name
        </Kb.Text>
        <Kb.Input
          hideLabel={true}
          hideUnderline={true}
          inputStyle={Styles.collapseStyles([styles.inputElement, styles.tallSingleLineInput])}
          style={styles.input}
          value={props.name}
          onChangeText={props.onNameChange}
          autoFocus={true}
          maxLength={accountNameMaxLength}
        />
        {!!props.error && (
          <Kb.Text type="BodySmall" style={styles.error}>
            {props.error}
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.InfoNote containerStyle={styles.infoNote}>
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text type="BodySmall" style={styles.textCenter}>
            Your account name is encrypted and only visible to you.
          </Kb.Text>
        </Kb.Box2>
      </Kb.InfoNote>
    </>
  )
}

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
      width: '100%',
      textAlign: 'left',
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
  tallSingleLineInput: Styles.platformStyles({
    isMobile: {
      paddingBottom: 0,
      paddingTop: 0,
    },
  }),
  infoNote: Styles.platformStyles({
    isElectron: {
      marginTop: Styles.globalMargins.medium,
    },
    isMobile: {
      marginTop: Styles.globalMargins.small,
    },
  }),
  textCenter: {textAlign: 'center'},
})

export default EnterNamePopup
