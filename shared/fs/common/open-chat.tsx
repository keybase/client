import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import * as T from '../../constants/types'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Util from '../../util/kbfs'

type OwnProps = {
  path: T.FS.Path
}

const OpenChat = (props: any) =>
  props.onChat && (
    <Kb.WithTooltip tooltip={`Chat with users in this ${props.isTeam ? 'team' : 'folder'}`}>
      <Kb.Icon
        type="iconfont-chat"
        color={Styles.globalColors.black_50}
        fontSize={16}
        onClick={props.onChat}
        style={styles.headerIcon}
      />
    </Kb.WithTooltip>
  )

const styles = Styles.styleSheetCreate(
  () =>
    ({
      headerIcon: {
        padding: Styles.globalMargins.tiny,
      },
    }) as const
)

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const isTeam = C.isTeamPath(path)
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const _onChat = () => {
    previewConversation({
      reason: 'files',
      // tlfToParticipantsOrTeamname will route both public and private
      // folders to a private chat, which is exactly what we want.
      ...Util.tlfToParticipantsOrTeamname(T.FS.pathToString(path)),
    })
  }

  const onChat = Constants.canChat(path) ? _onChat : null
  const props = {
    isTeam,
    onChat,
  }
  return <OpenChat {...props} />
}
