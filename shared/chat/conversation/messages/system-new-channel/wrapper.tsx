import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import UserNotice from '../user-notice'
import {useThreadMeta} from '../../thread-context'
import {makeMessageWrapper} from '../wrapper/wrapper'

type OwnProps = {message: T.Chat.MessageSystemNewChannel}

function SystemNewChannelContainer(p: OwnProps) {
  const styles = useStyles()
  const theme = Kb.Styles.useTheme()
  const {message} = p
  const teamID = useThreadMeta(m => m.teamID)
  const navigateAppend = C.Router2.navigateAppend
  const onManageChannels = () => navigateAppend({name: 'teamAddToChannels', params: {teamID}})

  const descStyleOverride = {
    link: {fontSize: isMobile ? 15 : 13, fontWeight: '600'},
    paragraph: {
      color: isMobile ? theme.black_50 : theme.black_50OrWhite_40,
      fontSize: isMobile ? 15 : 13,
    },
  } as const
  return (
    <UserNotice>
      <Kb.Markdown
        smallStandaloneEmoji={true}
        styleOverride={descStyleOverride}
        selectable={true}
        style={styles.text}
      >
        {message.text.stringValue()}
      </Kb.Markdown>
      <Kb.Text
        onClick={onManageChannels}
        type="BodySmallSemiboldSecondaryLink"
        style={{color: theme.blueDark}}
      >
        Browse other channels
      </Kb.Text>
    </UserNotice>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      text: Kb.Styles.platformStyles({
        isElectron: {color: theme.black_50OrWhite_40},
        isMobile: {color: theme.black_50},
      }),
    }) as const
)

export default makeMessageWrapper('systemNewChannel', message => <SystemNewChannelContainer message={message} />)
