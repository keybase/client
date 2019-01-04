// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import ConversationList from '../../chat/conversation-list/conversation-list-container'
import type {Props} from '.'

const Header = (props: Props) => (
  <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true}>
    <Kb.Text type="BodyBigLink" style={styles.button} onClick={props.onCancel}>
      Cancel
    </Kb.Text>
    <Kb.Box2 direction="vertical" style={styles.headerContent} fullWidth={true} centerChildren={true}>
      <Kb.Box2 direction="horizontal" gap="xtiny">
        <Kbfs.PathItemIcon path={props.path} size={16} />
        <Kb.Text type="BodySmallSemibold">{Types.getPathName(props.path)}</Kb.Text>
      </Kb.Box2>
      <Kb.Text type="BodySemibold">Send to ...</Kb.Text>
    </Kb.Box2>
    <Kb.Text type="BodyBigLink" style={styles.button} onClick={props.send}>
      Send
    </Kb.Text>
  </Kb.Box2>
)

const WithHeader = Kb.HeaderOrPopup(ConversationList)

export default (props: Props) => <WithHeader customComponent={<Header {...props} />} />

const styles = Styles.styleSheetCreate({
  button: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  headerContent: {
    flex: 1,
    padding: Styles.globalMargins.xtiny,
  },
})
