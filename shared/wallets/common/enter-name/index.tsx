import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type EnterNameProps = {
  error?: string
  name: string
  onEnterKeyDown?: () => void
  onNameChange: (name: string) => void
}

const EnterName = (props: EnterNameProps) => {
  // TODO use wallet staticConfig to keep in sync with the service
  const accountNameMaxLength = 24

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      gap={Styles.isMobile ? 'small' : 'medium'}
      style={{flex: 1}}
      gapStart={!Styles.isMobile}
    >
      {!Styles.isMobile && (
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Icon type="icon-wallet-add-48" />
          <Kb.Text type="Header">Name your account</Kb.Text>
        </Kb.Box2>
      )}
      <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.inputContainer}>
        <Kb.LabeledInput
          placeholder="Account name"
          value={props.name}
          onEnterKeyDown={props.onEnterKeyDown}
          onChangeText={props.onNameChange}
          autoFocus={true}
          maxLength={accountNameMaxLength}
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
            Your account name is encrypted and only visible to you.
          </Kb.Text>
        </Kb.Box2>
      </Kb.InfoNote>
    </Kb.Box2>
  )
}

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
      icon: {
        height: 48,
        width: 48,
      },
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
          paddingBottom: Styles.globalMargins.tiny,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)

export default EnterName
