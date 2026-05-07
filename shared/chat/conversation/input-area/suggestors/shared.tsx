import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

type BotCommandUpdateStatusProps = {
  status: T.RPCChat.UIBotCommandsUpdateStatusTyp
}

export const BotCommandUpdateStatus = (props: BotCommandUpdateStatusProps) => {
  let statusText = ''
  switch (props.status) {
    case T.RPCChat.UIBotCommandsUpdateStatusTyp.uptodate:
      statusText = 'Bot commands are up-to-date'
      break
    case T.RPCChat.UIBotCommandsUpdateStatusTyp.failed:
      statusText = 'Failed to update bot commands'
      break
    case T.RPCChat.UIBotCommandsUpdateStatusTyp.updating:
      statusText = 'Updating bot commands...'
      break
    default:
  }
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.botCommandContainer}>
      <Kb.Text type="BodyTiny">{statusText}</Kb.Text>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  botCommandContainer: Kb.Styles.platformStyles({
    isElectron: {
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Kb.Styles.globalMargins.tiny,
    },
  }),
}))
