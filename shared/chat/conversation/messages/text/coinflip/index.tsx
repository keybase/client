import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import CoinFlipError from './errors'
import CoinFlipParticipants from './participants'
import CoinFlipResult from './results'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import {pluralize} from '@/util/string'
import {useConversationThreadMessage, useConversationThreadSelector} from '../../../thread-context'
import {useConversationSendActions} from '../../../send-actions'
import {useSyncRowLayout} from '../../use-sync-row-layout'

// The flip result arrives via a separate status notification, not with the thread, so on initial
// load (an already-finished flip) the card first-paints with no result and then grows when the
// status streams in — which can leave the thread scrolled above the newest message. We can't know
// the exact result size ahead of time, but the command text tells us the result TYPE, which is
// enough to reserve an approximate result height up front so the card opens close to its final
// size. Imperfect for multi-card / multi-item shuffles whose size depends on status-only data.
const guessFlipResultHeight = (raw: string) => {
  const s = raw.replace(/^\/flip/i, '').trim().toLowerCase()
  if (s.startsWith('cards')) return 80 // dealt hand(s): at least one card row
  if (s.includes(',')) return 120 // shuffle list (capped, ~5 items)
  if (/^\d+(\s*(\.\.|-)\s*\d+)?$/.test(s)) return 40 // number / range: one line
  return 56 // coin (default + most common): 48 icon + marginTop
}

function CoinFlipContainer() {
  const ordinal = useOrdinal()
  const message = useConversationThreadMessage(ordinal)
  const isSendError = message?.type === 'text' ? !!message.errorReason : false
  const text = message?.type === 'text' ? message.text : undefined
  const flipGameID = (message?.type === 'text' && message.flipGameID) || ''
  const {sendMessage} = useConversationSendActions()
  const status = useConversationThreadSelector(s => s.flipStatusMap.get(flipGameID))
  // Reserve the result height only while the status has not loaded yet (the open-an-old-flip case).
  // Once status is present the real result fills it, and live in-progress flips get no empty gap.
  const reservedResultHeight = status === undefined ? guessFlipResultHeight(text?.stringValue() ?? '') : 0
  const onFlipAgain = () => {
    if (text) {
      sendMessage(text.stringValue())
    }
  }
  const phase = status?.phase
  const errorInfo = phase === T.RPCChat.UICoinFlipPhase.error ? status?.errorInfo : undefined
  const participants = status?.participants ?? undefined
  const resultInfo = status?.resultInfo
  const commitmentVis = status?.commitmentVisualization
  const revealVis = status?.revealVisualization
  const showParticipants = phase === T.RPCChat.UICoinFlipPhase.complete
  const numParticipants = participants?.length ?? 0

  // The flip result streams in after first paint and grows the card; flush the row measure so the
  // list re-pins to the newest message instead of parking above it. Keyed on the status signals
  // that change the card height (loaded yet, phase, participant count, result present).
  useSyncRowLayout(`${status === undefined ? 0 : 1}|${phase ?? -1}|${numParticipants}|${resultInfo ? 1 : 0}`)

  const revealed =
    participants?.reduce((r, p) => {
      return r + (p.reveal ? 1 : 0)
    }, 0) ?? 0
  const revealSummary = `${revealed} / ${numParticipants}`

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <CoinFlipParticipants
        attachTo={attachTo}
        onHidden={hidePopup}
        participants={participants}
        visible={true}
      />
    )
  }
  const {showPopup, hidePopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const statusText = showParticipants ? (
    <Kb.Box2 direction="vertical" onMouseOver={showPopup} onMouseLeave={hidePopup} ref={popupAnchor}>
      {!isMobile && (
        <Kb.Text selectable={true} type="BodySmall">
          Secured by{' '}
        </Kb.Text>
      )}
      <Kb.Text selectable={true} type="BodySmallPrimaryLink" onClick={showPopup}>
        {`${numParticipants} ${pluralize('participant', numParticipants)}`}
      </Kb.Text>
      {popup}
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="vertical">
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
        <Kb.Text selectable={true} type="BodySmallSemibold">
          {!isMobile && 'Collecting '}commitments: {numParticipants}
        </Kb.Text>
        {phase === T.RPCChat.UICoinFlipPhase.reveals && (
          <Kb.Icon type="iconfont-check" color={Kb.Styles.globalColors.green} sizeType="Small" />
        )}
      </Kb.Box2>
      {phase === T.RPCChat.UICoinFlipPhase.reveals && (
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
          <Kb.Text selectable={true} type="BodySmallSemibold">
            {!isMobile && 'Collecting '}secrets: {revealSummary}
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  const commitSrc = `data:image/png;base64,${commitmentVis}`
  const revealSrc = `data:image/png;base64,${revealVis}`
  return (
    <Kb.Box2
      direction="vertical"
      style={Kb.Styles.collapseStyles([!errorInfo && styles.container])}
      fullWidth={true}
    >
      {errorInfo ? (
        <CoinFlipError error={errorInfo} />
      ) : (
        <>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            <Kb.Box2 direction="vertical">
              {(commitmentVis?.length ?? 0) > 0 ? (
                <Kb.Image src={commitSrc} style={styles.progressVis} />
              ) : (
                <Kb.Box2
                  direction="vertical"
                  style={Kb.Styles.collapseStyles([styles.placeholder, styles.progressVis])}
                />
              )}
            </Kb.Box2>
            <Kb.Box2 direction="vertical">
              {(revealVis?.length ?? 0) > 0 && phase !== T.RPCChat.UICoinFlipPhase.commitment ? (
                <Kb.Image src={revealSrc} style={styles.progressVis} />
              ) : (
                <Kb.Box2
                  direction="vertical"
                  style={Kb.Styles.collapseStyles([styles.placeholder, styles.progressVis])}
                />
              )}
            </Kb.Box2>
            <Kb.Box2 direction="vertical">{statusText}</Kb.Box2>
          </Kb.Box2>
        </>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={{minHeight: reservedResultHeight}}>
        {resultInfo && <CoinFlipResult result={resultInfo} />}
      </Kb.Box2>
      {isSendError || !!errorInfo ? (
        <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.flipAgainContainer}>
          <Kb.Text type="BodySmallSecondaryLink" onClick={onFlipAgain} style={styles.error}>
            Try again
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Box2
          direction="vertical"
          alignSelf="flex-start"
          style={
            phase === T.RPCChat.UICoinFlipPhase.complete
              ? styles.flipAgainContainer
              : styles.flipAgainContainerHidden
          }
        >
          <Kb.Text type="BodySmallSecondaryLink" onClick={onFlipAgain}>
            Flip again
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'flex-start',
        borderColor: Kb.Styles.globalColors.grey,
        borderLeftWidth: 4,
        borderStyle: 'solid',
        marginTop: Kb.Styles.globalMargins.xtiny,
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      error: {color: Kb.Styles.globalColors.redDark},
      flipAgainContainer: {paddingTop: Kb.Styles.globalMargins.tiny},
      flipAgainContainerHidden: {opacity: 0, paddingTop: Kb.Styles.globalMargins.tiny},
      placeholder: {backgroundColor: Kb.Styles.globalColors.grey},
      progressVis: {
        height: 40,
        width: 64,
      },
    }) as const
)

export default CoinFlipContainer
