import * as Kb from '@/common-adapters'
import * as T from '../../../../constants/types'
import {formatDurationShort} from '../../../../util/timestamp'

export const ExplodingMeta = ({explodingModeSeconds}: {explodingModeSeconds: number}) => {
  if (explodingModeSeconds === 0) {
    // nothing to show
    return null
  }
  return (
    <Kb.Meta
      backgroundColor={Kb.Styles.globalColors.black_on_white}
      noUppercase={true}
      style={styles.timeBadge}
      size="Small"
      title={formatDurationShort(explodingModeSeconds * 1000)}
    />
  )
}

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
  timeBadge: Kb.Styles.platformStyles({
    common: {
      borderColor: Kb.Styles.globalColors.white,
      borderRadius: 3,
      borderStyle: 'solid',
    },
    isElectron: {
      borderWidth: 1,
      cursor: 'pointer',
      marginLeft: -11,
      marginTop: -6,
    },
    isMobile: {
      borderWidth: 2,
      marginLeft: -5,
      marginTop: -1,
    },
  }),
}))
