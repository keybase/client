import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {globalMargins, styleSheetCreate} from '../../../styles'
import {namedConnect} from '../../../util/container'
import {appendNewChatBuilder} from '../../../actions/typed-routes'
import * as Constants from '../../../constants/chat2'
import Flags from '../../../util/feature-flags'

type OwnProps = {
  hide: boolean
  onNewChat: () => void
}

const _HeaderNewChatButton = (props: OwnProps) => {
  if (props.hide) {
    return null
  }
  return (
    <Kb.Button
      label={Flags.wonderland ? 'New chat 🐇' : 'New chat'}
      mode="Primary"
      onClick={props.onNewChat}
      small={true}
      style={styles.button}
      type="Default"
    />
  )
}

const HeaderNewChatButton = namedConnect(
  state => ({
    hide:
      state.chat2.inboxHasLoaded &&
      !state.chat2.metaMap.some((_, id) => Constants.isValidConversationIDKey(id)),
  }),
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
