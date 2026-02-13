import * as C from '@/constants'
import * as Crypto from '@/stores/crypto'
import * as Kb from '@/common-adapters'

const placeholder = 'Search people'

const Recipients = () => {
  const recipients = Crypto.useCryptoState(s => s.encrypt.recipients)
  const inProgress = Crypto.useCryptoState(s => s.encrypt.inProgress)
  const clearRecipients = Crypto.useCryptoState(s => s.dispatch.clearRecipients)
  const appendEncryptRecipientsBuilder = C.useRouterState(s => s.appendEncryptRecipientsBuilder)

  const onAddRecipients = () => {
    if (inProgress) return
    appendEncryptRecipientsBuilder()
  }

  const onClearRecipients = () => {
    if (inProgress) return
    clearRecipients()
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.recipientsContainer}>
        <Kb.Text type="BodyTinySemibold" style={styles.toField}>
          To:
        </Kb.Text>
        {recipients.length ? (
          <Kb.ConnectedUsernames type="BodyBold" usernames={recipients} colorFollowing={true} />
        ) : (
          <>
            <Kb.PlainInput
              disabled={inProgress}
              placeholder={placeholder}
              allowFontScaling={false}
              onFocus={onAddRecipients}
              style={styles.input}
            />
          </>
        )}
        {recipients.length ? (
          <Kb.Icon
            type="iconfont-remove"
            boxStyle={styles.removeRecipients}
            style={Kb.Styles.isMobile && styles.removeRecipients}
            color={Kb.Styles.globalColors.black_20}
            hoverColor={inProgress ? Kb.Styles.globalColors.black_20 : undefined}
            onClick={onClearRecipients}
          />
        ) : null}
      </Kb.Box2>
      <Kb.Divider />
    </Kb.Box2>
  )
}

const recipientsRowHeight = 40
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      input: {
        ...Kb.Styles.globalStyles.flexGrow,
        alignSelf: 'center',
        borderBottomWidth: 0,
        borderWidth: 0,
        marginLeft: Kb.Styles.globalMargins.xtiny,
        paddingLeft: 0,
      },
      recipientsContainer: {
        minHeight: recipientsRowHeight,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.xsmall,
        paddingRight: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
      removeRecipients: {
        ...Kb.Styles.globalStyles.flexGrow,
        ...Kb.Styles.globalStyles.flexBoxRow,
        justifyContent: 'flex-end',
        marginRight: Kb.Styles.globalMargins.tiny,
        textAlign: 'right',
      },
      toField: {
        marginRight: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default Recipients
