import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type EnterKeyProps = {
  error: string
  onKeyChange: (key: string) => void
  secretKey: string
}

const EnterKey = (props: EnterKeyProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    gap={Styles.isMobile ? 'small' : 'medium'}
    style={{flex: 1}}
    gapStart={!Styles.isMobile}
  >
    {!Styles.isMobile && (
      <Kb.Box2 direction="vertical" gap="medium" centerChildren={true}>
        <Kb.Icon type="icon-wallet-add-48" />
        <Kb.Text type="Header">Link an existing account</Kb.Text>
      </Kb.Box2>
    )}
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
      <Kb.LabeledInput
        placeholder="Paste your secret key (SDNBUW...SC7632)"
        multiline={true}
        rowsMin={2}
        rowsMax={2}
        value={props.secretKey}
        onChangeText={props.onKeyChange}
        autoFocus={true}
        maxLength={56}
        error={!!props.error}
      />
      {!!props.error && (
        <Kb.Text type="BodySmall" style={styles.error}>
          {props.error}
        </Kb.Text>
      )}
    </Kb.Box2>
    <Kb.InfoNote>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text center={true} type="BodySmall" style={styles.infoText}>
          This imports a Stellar secret key so you can also use it in Keybase. You can continue to use this
          Stellar account in other wallet apps.
        </Kb.Text>
      </Kb.Box2>
    </Kb.InfoNote>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      error: Styles.platformStyles({
        common: {
          color: Styles.globalColors.redDark,
          textAlign: 'left',
          width: '100%',
        },
        isElectron: {
          wordWrap: 'break-word',
        },
      }),
      infoText: Styles.platformStyles({
        isMobile: {
          paddingLeft: Styles.globalMargins.medium,
          paddingRight: Styles.globalMargins.medium,
        },
      }),
      inputContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
        },
        isElectron: {width: '100%'},
        isMobile: {
          borderBottomWidth: 1,
          borderColor: Styles.globalColors.black_05,
          borderStyle: 'solid',
          paddingBottom: Styles.globalMargins.tiny,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)

export default EnterKey
