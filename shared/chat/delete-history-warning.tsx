import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {useConversationMeta} from './conversation/data-hooks'
import logger from '@/logger'

type Props = {
  conversationIDKey?: T.Chat.ConversationIDKey
}

const DeleteHistoryWarning = (props: Props) => {
  const conversationIDKey = props.conversationIDKey ?? T.Chat.noConversationIDKey
  const onCancel = C.Router2.navigateUp
  const clearModals = C.Router2.clearModals
  const {tlfname} = useConversationMeta(conversationIDKey)
  const onDeleteHistory = () => {
    clearModals()
    const f = async () => {
      if (!tlfname) {
        logger.warn('Deleting message history for non-existent TLF:')
        return
      }
      await T.RPCChat.localPostDeleteHistoryByAgeRpcPromise({
        age: 0,
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        tlfName: tlfname,
        tlfPublic: false,
      })
    }
    C.ignorePromise(f())
  }

  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([
        styles.padding,
        styles.box,
      ])}
    >
      <Kb.ImageIcon type={isMobile ? 'icon-message-deletion-64' : 'icon-message-deletion-48'} />
      <Kb.Text style={{padding: Kb.Styles.globalMargins.small}} type="Header">
        Delete conversation history?
      </Kb.Text>
      <Kb.Text center={isMobile} style={styles.text} type="Body">
        You are about to delete all the messages in this conversation. For everyone.
      </Kb.Text>
      <Kb.Box2 direction={isMobile ? 'verticalReverse' : 'horizontal'} style={styles.buttonBox}>
        <Kb.Button
          type="Dim"
          style={styles.button}
          onClick={onCancel}
          label="Cancel"
          fullWidth={isMobile}
        />
        <Kb.Button
          type="Danger"
          style={styles.button}
          onClick={onDeleteHistory}
          label="Yes, clear for everyone"
          fullWidth={isMobile}
        />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.centered(),
          backgroundColor: Kb.Styles.globalColors.white,
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          width: '100%',
        },
      }),
      button: Kb.Styles.platformStyles({
        isElectron: {marginLeft: Kb.Styles.globalMargins.tiny},
        isMobile: {marginTop: Kb.Styles.globalMargins.tiny},
      }),
      buttonBox: Kb.Styles.platformStyles({
        common: {marginTop: Kb.Styles.globalMargins.xlarge},
        isMobile: {
          flex: 1,
          paddingTop: Kb.Styles.globalMargins.xlarge,
          width: '100%',
        },
      }),
      padding: Kb.Styles.platformStyles({
        isElectron: {
          marginBottom: 40,
          marginLeft: 80,
          marginRight: 80,
          marginTop: 40,
        },
        isMobile: {paddingTop: Kb.Styles.globalMargins.xlarge},
      }),
      text: {padding: Kb.Styles.globalMargins.small},
    }) as const
)

export default DeleteHistoryWarning
