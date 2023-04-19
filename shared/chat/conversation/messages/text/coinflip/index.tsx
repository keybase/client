import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import CoinFlipError from './errors'
import CoinFlipParticipants from './participants'
import CoinFlipResult from './results'
import {ConvoIDContext, OrdinalContext} from '../../ids-context'
import {pluralize} from '../../../../../util/string'

const CoinFlipContainer = React.memo(function CoinFlipContainer() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)

  const message = Container.useSelector(state => state.chat2.messageMap.get(conversationIDKey)?.get(ordinal))
  const isSendError = message?.type === 'text' ? !!message.errorReason : false
  const text = message?.type === 'text' ? message.text : undefined
  const flipGameID = (message?.type === 'text' && message.flipGameID) || ''
  const status = Container.useSelector(state => state.chat2.flipStatusMap.get(flipGameID))
  const dispatch = Container.useDispatch()
  const onFlipAgain = React.useCallback(() => {
    text && dispatch(Chat2Gen.createMessageSend({conversationIDKey, text}))
  }, [dispatch, conversationIDKey, text])
  const phase = status?.phase
  const errorInfo = phase === RPCChatTypes.UICoinFlipPhase.error ? status?.errorInfo : undefined
  const participants = status?.participants ?? undefined
  const resultInfo = status?.resultInfo
  const commitmentVis = status?.commitmentVisualization
  const revealVis = status?.revealVisualization
  const showParticipants = phase === RPCChatTypes.UICoinFlipPhase.complete
  const numParticipants = participants?.length ?? 0

  const revealed =
    participants?.reduce((r, p) => {
      return r + (p.reveal ? 1 : 0)
    }, 0) ?? 0
  const revealSummary = `${revealed} / ${numParticipants}`

  const {setShowingPopup, toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <CoinFlipParticipants
      attachTo={attachTo}
      onHidden={toggleShowingPopup}
      participants={participants}
      visible={showingPopup}
    />
  ))
  const showPopup = React.useCallback(() => {
    setShowingPopup(true)
  }, [setShowingPopup])
  const hidePopup = React.useCallback(() => {
    setShowingPopup(false)
  }, [setShowingPopup])

  const statusText = showParticipants ? (
    <Kb.Box2 direction="vertical" onMouseOver={showPopup} onMouseLeave={hidePopup} ref={popupAnchor}>
      {!Styles.isMobile && (
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
          {!Styles.isMobile && 'Collecting '}commitments: {numParticipants}
        </Kb.Text>
        {phase === RPCChatTypes.UICoinFlipPhase.reveals && (
          <Kb.Icon type="iconfont-check" color={Styles.globalColors.green} sizeType="Small" />
        )}
      </Kb.Box2>
      {phase === RPCChatTypes.UICoinFlipPhase.reveals && (
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
          <Kb.Text selectable={true} type="BodySmallSemibold">
            {!Styles.isMobile && 'Collecting '}secrets: {revealSummary}
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  const commitSrc = `data:image/png;base64, ${commitmentVis}`
  const revealSrc = `data:image/png;base64, ${revealVis}`
  return (
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([!errorInfo && styles.container])}
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
                  style={Styles.collapseStyles([styles.placeholder, styles.progressVis])}
                />
              )}
            </Kb.Box2>
            <Kb.Box2 direction="vertical">
              {(revealVis?.length ?? 0) > 0 && phase !== RPCChatTypes.UICoinFlipPhase.commitment ? (
                <Kb.Image src={revealSrc} style={styles.progressVis} />
              ) : (
                <Kb.Box2
                  direction="vertical"
                  style={Styles.collapseStyles([styles.placeholder, styles.progressVis])}
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
            phase === RPCChatTypes.UICoinFlipPhase.complete
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        alignSelf: 'flex-start',
        borderColor: Styles.globalColors.grey,
        borderLeftWidth: 4,
        borderStyle: 'solid',
        marginTop: Styles.globalMargins.xtiny,
        paddingLeft: Styles.globalMargins.tiny,
      },
      error: {color: Styles.globalColors.redDark},
      flipAgainContainer: {paddingTop: Styles.globalMargins.tiny},
      flipAgainContainerHidden: {opacity: 0, paddingTop: Styles.globalMargins.tiny},
      placeholder: {backgroundColor: Styles.globalColors.grey},
      progress: Styles.platformStyles({
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
      result: Styles.platformStyles({
        common: {fontWeight: '600'},
        isElectron: {
          cursor: 'text',
          userSelect: 'text',
          wordBreak: 'break-all',
        },
      }),
      statusContainer: {paddingTop: Styles.globalMargins.tiny},
    } as const)
)

export default CoinFlipContainer
