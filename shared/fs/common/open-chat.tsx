import * as Container from '../../util/container'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as Styles from '../../styles'
import * as Util from '../../util/kbfs'

type OwnProps = {
  path: Types.Path
}

const OpenChat = props =>
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
    } as const)
)

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const isTeam = Constants.isTeamPath(path)
  const _onChat = () => {
    dispatch(
      Chat2Gen.createPreviewConversation({
        reason: 'files',
        // tlfToParticipantsOrTeamname will route both public and private
        // folders to a private chat, which is exactly what we want.
        ...Util.tlfToParticipantsOrTeamname(Types.pathToString(path)),
      })
    )
  }

  const onChat = Constants.canChat(path) ? _onChat : null
  const dispatch = Container.useDispatch()
  const props = {
    isTeam,
    onChat,
  }
  return <OpenChat {...props} />
}
