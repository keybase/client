import * as Kb from '@/common-adapters'

type Props = {
  inProgress: boolean
  onAddRecipients: () => void
  onClearRecipients: () => void
  recipients: ReadonlyArray<string>
}

const placeholder = 'Search people'

const Recipients = ({inProgress, onAddRecipients, onClearRecipients, recipients}: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.recipientsContainer}>
        <Kb.Text type="BodyTinySemibold" style={styles.toField}>
          To:
        </Kb.Text>
        {recipients.length ? (
          <Kb.ConnectedUsernames type="BodyBold" usernames={recipients} colorFollowing={true} />
        ) : (
          <Kb.Input3
            disabled={inProgress}
            placeholder={placeholder}
            onFocus={onAddRecipients}
            hideBorder={true}
            containerStyle={styles.input}
          />
        )}
        {recipients.length ? (
          <Kb.Box2 direction="horizontal" style={styles.removeRecipients}>
            <Kb.Icon
              type="iconfont-remove"
              color={Kb.Styles.globalColors.black_20}
              {...(inProgress
                ? {hoverColor: Kb.Styles.globalColors.black_20}
                : {onClick: onClearRecipients})}
            />
          </Kb.Box2>
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
        backgroundColor: Kb.Styles.globalColors.transparent,
        marginLeft: Kb.Styles.globalMargins.xtiny,
        padding: 0,
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
