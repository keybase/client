import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {globalMargins, styleSheetCreate} from '../../../styles'
import {namedConnect} from '../../../util/container'
import {appendNewChatBuilder} from '../../../actions/typed-routes'

const _HeaderNewChatButton = props => (
  <Kb.Button
    mode="Primary"
    type="Default"
    label="New chat"
    onClick={props.onNewChat}
    small={true}
    style={styles.button}
  />
)

const HeaderNewChatButton = namedConnect(
  () => ({}),
  dispatch => ({
    onNewChat: () => dispatch(appendNewChatBuilder()),
  }),
  (stateProps, dispatchProps) => ({...stateProps, ...dispatchProps}),
  'HeaderNewChatButton'
)(_HeaderNewChatButton)

const styles = styleSheetCreate({
  button: {
    marginLeft: globalMargins.small,
    marginRight: globalMargins.small,
  },
})

export {HeaderNewChatButton}
