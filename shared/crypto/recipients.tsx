import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

type Props = {
  inProgress: boolean
  onAddRecipients: () => void
  onClearRecipients: () => void
  recipients: ReadonlyArray<string>
}

const placeholder = 'Search people'

const Recipients = ({inProgress, onAddRecipients, onClearRecipients, recipients}: Props) => {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.recipientsContainer}>
        <Kb.Text type="BodyTinySemibold" style={styles.toField}>
          To:
        </Kb.Text>
        {recipients.length ? (
          <Kb.ConnectedUsernames type="BodyBold" usernames={recipients} colorFollowing={true} />
        ) : (
          <Kb.ClickableBox
            direction="horizontal"
            style={styles.input}
            testID={TestIDs.CRYPTO_RECIPIENTS}
            onClick={inProgress ? undefined : onAddRecipients}
          >
            {/* Display-only input; block it from taking focus so opening the
                builder needs a real click — a focused input would refire
                onFocus on window refocus and reopen the modal. */}
            <Kb.Box2 direction="horizontal" fullWidth={true} pointerEvents="none">
              <Kb.Input3
                disabled={inProgress}
                placeholder={placeholder}
                hideBorder={true}
                containerStyle={styles.inputInner}
              />
            </Kb.Box2>
          </Kb.ClickableBox>
        )}
        {recipients.length ? (
          <Kb.Box2 direction="horizontal" style={styles.removeRecipients}>
            <Kb.Icon
              type="iconfont-remove"
              color={theme.black_20}
              hoverColor={inProgress ? theme.black_20 : undefined}
              onClick={inProgress ? undefined : onClearRecipients}
            />
          </Kb.Box2>
        ) : null}
      </Kb.Box2>
      <Kb.Divider />
    </Kb.Box2>
  )
}

const recipientsRowHeight = 40
const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      input: {
        ...Kb.Styles.globalStyles.flexGrow,
        alignSelf: 'center',
        marginLeft: Kb.Styles.globalMargins.xtiny,
      },
      inputInner: {
        ...Kb.Styles.globalStyles.flexGrow,
        backgroundColor: theme.transparent,
        padding: 0,
      },
      recipientsContainer: {
        minHeight: recipientsRowHeight,
        ...Kb.Styles.padding(
          Kb.Styles.globalMargins.tiny,
          Kb.Styles.globalMargins.tiny,
          Kb.Styles.globalMargins.tiny,
          Kb.Styles.globalMargins.xsmall
        ),
      },
      removeRecipients: {
        ...Kb.Styles.globalStyles.flexGrow,
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
