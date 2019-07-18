import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import {formatDurationShort} from '../../../../util/timestamp'

export const ExplodingMeta = ({explodingModeSeconds}: {explodingModeSeconds: number}) => {
  if (explodingModeSeconds === 0) {
    // nothing to show
    return null
  }
  return (
    <Kb.Meta
      backgroundColor={Styles.globalColors.black_on_white}
      noUppercase={true}
      style={styles.timeBadge}
      size="Small"
      title={formatDurationShort(explodingModeSeconds * 1000)}
    />
  )
}

type BotCommandUpdateStatusProps = {
  status: RPCChatTypes.UIBotCommandsUpdateStatus
}

export class BotCommandUpdateStatus extends React.Component<BotCommandUpdateStatusProps> {
  _botCommandUpdateStatusText = () => {
    switch (this.props.status) {
      case RPCChatTypes.UIBotCommandsUpdateStatus.uptodate:
        return 'Commands are up-to-date'
      case RPCChatTypes.UIBotCommandsUpdateStatus.failed:
        return 'Failed to update commands'
      case RPCChatTypes.UIBotCommandsUpdateStatus.updating:
        return 'Updating commands...'
    }
  }

  render() {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.botCommandContainer}>
        <Kb.Text type="BodyTiny">{this._botCommandUpdateStatusText()}</Kb.Text>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  botCommandContainer: Styles.platformStyles({
    isElectron: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
  timeBadge: Styles.platformStyles({
    common: {
      borderColor: Styles.globalColors.white,
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
})
