import {namedConnect} from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Styles from '../../styles'
import * as Util from '../../util/kbfs'
import * as React from 'react'

type OwnProps = {
  path: Types.Path
}

const OpenChat = props =>
  props.onChat && (
    <Kb.WithTooltip text={`Chat with users in this ${props.isTeam ? 'team' : 'folder'}`}>
      <Kb.Icon
        type="iconfont-chat"
        color={Styles.globalColors.black_50}
        fontSize={16}
        onClick={props.onChat}
        style={styles.headerIcon}
      />
    </Kb.WithTooltip>
  )

const styles = Styles.styleSheetCreate({
  headerIcon: {
    padding: Styles.globalMargins.tiny,
  },
})

const mapDispatchToProps = (dispatch, {path}: OwnProps) => ({
  isTeam: Constants.isTeamPath(path),
  onChat: Constants.canChat(path)
    ? () =>
        dispatch(
          Chat2Gen.createPreviewConversation({
            reason: 'files',
            // tlfToParticipantsOrTeamname will route both public and private
            // folders to a private chat, which is exactly what we want.
            ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
          })
        )
    : null,
})

const mergeProps = (_, d) => d

export default namedConnect(() => ({}), mapDispatchToProps, mergeProps, 'OpenChat')(OpenChat)
