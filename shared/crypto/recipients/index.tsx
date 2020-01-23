import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  onAddRecipients: () => void
  onClearRecipients: () => void
  recipients: Array<string>
}

const placeholder = 'Search people'

const Recipients = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.recipientsContainer}>
      <Kb.Text type="BodyTinySemibold" style={styles.toField}>
        To:
      </Kb.Text>
      {props.recipients?.length ? (
        <Kb.ConnectedUsernames type="BodySemibold" usernames={props.recipients} colorFollowing={true} />
      ) : (
        <>
          <Kb.PlainInput
            placeholder={placeholder}
            allowFontScaling={false}
            onFocus={props.onAddRecipients}
            style={styles.input}
          />
        </>
      )}
      {props.recipients?.length ? (
        <Kb.Icon
          type="iconfont-remove"
          boxStyle={styles.removeRecipients}
          color={Styles.globalColors.black_20}
          onClick={props.onClearRecipients}
        />
      ) : null}
    </Kb.Box2>
    <Kb.Divider />
  </Kb.Box2>
)

const recipientsRowHeight = 40
const styles = Styles.styleSheetCreate(
  () =>
    ({
      input: {
        ...Styles.globalStyles.flexGrow,
        alignSelf: 'center',
        borderBottomWidth: 0,
        borderWidth: 0,
        marginLeft: Styles.globalMargins.xtiny,
        paddingLeft: 0,
      },
      recipientsContainer: {
        minHeight: recipientsRowHeight,
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      },
      removeRecipients: {
        ...Styles.globalStyles.flexGrow,
        marginRight: Styles.globalMargins.tiny,
        textAlign: 'right',
      },
      toField: {
        marginRight: Styles.globalMargins.tiny,
      },
    } as const)
)

export default Recipients
