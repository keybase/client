import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {navToProfile} from '@/constants/router'
import {useConversationThreadID, useThreadMeta} from '../thread-context'
import {useConversationParticipants} from '../data-hooks'

const ResetUser = () => {
  const conversationIDKey = useConversationThreadID()
  const participantInfo = useConversationParticipants(conversationIDKey)
  const _participants = participantInfo.all
  const _resetParticipants = useThreadMeta(m => m.resetParticipants)
  const _viewProfile = navToProfile
  const username = [..._resetParticipants][0] || ''
  const nonResetUsers = new Set(_participants)
  _resetParticipants.forEach(r => nonResetUsers.delete(r))
  const allowChatWithoutThem = nonResetUsers.size > 1
  const chatWithoutThem = () => {
    C.Router2.previewConversation({
      participants: [...nonResetUsers],
      reason: 'resetChatWithoutThem',
    })
  }
  const letThemIn = () => {
    const f = async () => {
      await T.RPCChat.localAddTeamMemberAfterResetRpcPromise({
        convID: T.Chat.keyToConversationID(conversationIDKey),
        username,
      })
    }
    C.ignorePromise(f())
  }
  const viewProfile = () => _viewProfile(username)

  return (
    <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} padding="small" style={styles.container}>
      <Kb.ImageIcon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} style={styles.skullIcon} />
      <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={styles.textContainer}>
        <Kb.Text center={true} type="BodySemibold" negative={true}>
          <Kb.Text type="BodySemiboldLink" negative={true} onClick={viewProfile}>
            {username}
          </Kb.Text>{' '}
          <Kb.Text type="BodySemibold" negative={true}>
            {
              "lost all their devices and this account has new keys. If you want to let them into this chat and folder's history, you should either:"
            }
          </Kb.Text>
        </Kb.Text>
        <Kb.Box2 direction="vertical" style={styles.bullet} gap="tiny" gapStart={true}>
          <Kb.Text type="BodySemibold" negative={true}>
            1. Be satisfied with their new proofs, or
          </Kb.Text>
          <Kb.Text type="BodySemibold" negative={true}>
            2. Know them outside Keybase and have gotten a thumbs up from them.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text type="BodySemibold" negative={true} style={styles.lastSentence}>
          Don&apos;t let them in until one of the above is&nbsp;true.
        </Kb.Text>
        <Kb.ButtonBar align="center" direction="column" fullWidth={true} style={styles.buttonContainer}>
          <Kb.Button
            fullWidth={true}
            label="View profile"
            mode="Secondary"
            onClick={viewProfile}
            style={styles.secondaryOnRed}
            labelStyle={styles.secondaryOnRedLabel}
          />
          <Kb.Button
            fullWidth={true}
            label="Let them in"
            onClick={letThemIn}
            style={styles.primaryOnRed}
            labelStyle={styles.primaryOnRedLabel}
          />
        </Kb.ButtonBar>
        {allowChatWithoutThem && (
          <Kb.Text type="BodySemibold" negative={true}>
            Or until you’re sure,{' '}
            <Kb.Text type="BodySemiboldLink" negative={true} onClick={chatWithoutThem}>
              chat without them
            </Kb.Text>
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bullet: {
        maxWidth: 320,
      },
      buttonContainer: {
        ...Kb.Styles.marginV(Kb.Styles.globalMargins.small),
      },
      container: {
        backgroundColor: Kb.Styles.globalColors.red,
        marginBottom: -Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
      },
      lastSentence: {
        marginTop: Kb.Styles.globalMargins.medium,
        textAlign: 'center',
      },
      primaryOnRed: {backgroundColor: Kb.Styles.globalColors.white},
      primaryOnRedLabel: {color: Kb.Styles.globalColors.redDark},
      secondaryOnRed: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.black_20},
        isMobile: {borderWidth: 0},
      }),
      secondaryOnRedLabel: {color: Kb.Styles.globalColors.white},
      skullIcon: Kb.Styles.platformStyles({
        common: {margin: Kb.Styles.globalMargins.medium},
        isElectron: {...Kb.Styles.size(48)},
        isMobile: {...Kb.Styles.size(64)},
      }),
      textContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.large),
        },
      }),
    }) as const
)

export default ResetUser
