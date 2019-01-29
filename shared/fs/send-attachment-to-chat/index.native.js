// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import ConversationList from '../../chat/conversation-list/conversation-list-container'
import type {Props} from '.'

const Header = (props: Props) => (
  <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.headerContainer}>
    <Kb.Text type="BodyBigLink" style={styles.button} onClick={props.onCancel}>
      Cancel
    </Kb.Text>
    <Kb.Box2 direction="horizontal" style={styles.headerContent} fullWidth={true} centerChildren={true}>
      <Kb.Text type="BodySemibold" style={styles.filename}>
        {Types.getPathName(props.path)}
      </Kb.Text>
    </Kb.Box2>
    <Kb.Text type="BodyBigLink" style={styles.button} onClick={props.send}>
      Send
    </Kb.Text>
  </Kb.Box2>
)

const WithHeader = Kb.HeaderHoc(ConversationList)

// $FlowIssue TODO: fix HeaderHoc typing
export default (props: Props) => <WithHeader customComponent={<Header {...props} />} />

const styles = Styles.styleSheetCreate({
  button: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  filename: {
    textAlign: 'center',
  },
  headerContainer: {
    minHeight: 44,
  },
  headerContent: {
    flex: 1,
    flexShrink: 1,
    padding: Styles.globalMargins.xtiny,
  },
})
