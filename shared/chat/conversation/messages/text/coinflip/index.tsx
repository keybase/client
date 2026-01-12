import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as T from '@/constants/types'
import CoinFlipError from './errors'
import CoinFlipParticipants from './participants'
import CoinFlipResult from './results'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import {pluralize} from '@/util/string'

const CoinFlipContainer = React.memo(function CoinFlipContainer() {
  const ordinal = useOrdinal()
  const {isSendError, text, flipGameID, sendMessage} = Chat.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal)
      const isSendError = message?.type === 'text' ? !!message.errorReason : false
      const text = message?.type === 'text' ? message.text : undefined
      const flipGameID = (message?.type === 'text' && message.flipGameID) || ''
      const {sendMessage} = s.dispatch
      return {flipGameID, isSendError, message, sendMessage, text}
    })
  )
  const status = Chat.useChatState(s => s.flipStatusMap.get(flipGameID))
  const onFlipAgain = React.useCallback(() => {
    text && sendMessage(text.stringValue())
  }, [sendMessage, text])
  const phase = status?.phase
  const errorInfo = phase === T.RPCChat.UICoinFlipPhase.error ? status?.errorInfo : undefined
  const participants = status?.participants ?? undefined
  const resultInfo = status?.resultInfo
  const commitmentVis = status?.commitmentVisualization
  const revealVis = status?.revealVisualization
  const showParticipants = phase === T.RPCChat.UICoinFlipPhase.complete
  const numParticipants = participants?.length ?? 0

  const revealed =
    participants?.reduce((r, p) => {
      return r + (p.reveal ? 1 : 0)
    }, 0) ?? 0
  const revealSummary = `${revealed} / ${numParticipants}`

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <CoinFlipParticipants
          attachTo={attachTo}
          onHidden={hidePopup}
          participants={participants}
          visible={true}
        />
      )
    },
    [participants]
  )
  const {showPopup, hidePopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const statusText = showParticipants ? (
    <Kb.Box2Measure direction="vertical" onMouseOver={showPopup} onMouseLeave={hidePopup} ref={popupAnchor}>
      {!Kb.Styles.isMobile && (
        <Kb.Text selectable={true} type="BodySmall">
          Secured by{' '}
        </Kb.Text>
      )}
      <Kb.Text selectable={true} type="BodySmallPrimaryLink" onClick={showPopup}>
        {`${numParticipants} ${pluralize('participant', numParticipants)}`}
      </Kb.Text>
      {popup}
    </Kb.Box2Measure>
  ) : (
    <Kb.Box2 direction="vertical">
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
        <Kb.Text selectable={true} type="BodySmallSemibold">
          {!Kb.Styles.isMobile && 'Collecting '}commitments: {numParticipants}
        </Kb.Text>
        {phase === T.RPCChat.UICoinFlipPhase.reveals && (
          <Kb.Icon type="iconfont-check" color={Kb.Styles.globalColors.green} sizeType="Small" />
        )}
      </Kb.Box2>
      {phase === T.RPCChat.UICoinFlipPhase.reveals && (
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
          <Kb.Text selectable={true} type="BodySmallSemibold">
            {!Kb.Styles.isMobile && 'Collecting '}secrets: {revealSummary}
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
                <Kb.Image2 src={commitSrc} style={styles.progressVis} />
              ) : (
                <Kb.Box2
                  direction="vertical"
                  style={Kb.Styles.collapseStyles([styles.placeholder, styles.progressVis])}
                />
              )}
            </Kb.Box2>
            <Kb.Box2 direction="vertical">
              {(revealVis?.length ?? 0) > 0 && phase !== T.RPCChat.UICoinFlipPhase.commitment ? (
                <Kb.Image2 src={revealSrc} style={styles.progressVis} />
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
      <Kb.Box2 direction="vertical" fullWidth={true}>
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
})

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
      progress: Kb.Styles.platformStyles({
        isElectron: {
          cursor: 'text',
          userSelect: 'text',
          wordBreak: 'break-all',
        },
      }),
      progressVis: {
        height: 40,
        width: 64,
      },
      result: Kb.Styles.platformStyles({
        common: {fontWeight: '600'},
        isElectron: {
          cursor: 'text',
          userSelect: 'text',
          wordBreak: 'break-all',
        },
      }),
      statusContainer: {paddingTop: Kb.Styles.globalMargins.tiny},
    }) as const
)

export default CoinFlipContainer
