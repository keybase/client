import * as C from '@/constants'
import {isAssertion} from '@/constants/chat/helpers'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {useBlockButtonsInfo} from './block-buttons-state'
import {
  useConversationThreadID,
  useConversationThreadSelector,
  useThreadMeta,
} from '../conversation/thread-context'
import {useConversationParticipants} from '../conversation/data-hooks'

const dismissBlockButtons = (teamID: T.RPCGen.TeamID) => {
  const f = async () => {
    try {
      await T.RPCGen.userDismissBlockButtonsRpcPromise({tlfID: teamID})
    } catch (error) {
      if (error instanceof RPCError) {
        logger.error(`Couldn't dismiss block buttons: ${error.message}`)
      }
    }
  }
  C.ignorePromise(f())
}

const BlockButtons = () => {
  const navigateAppend = C.Router2.navigateAppend
  const conversationIDKey = useConversationThreadID()
  const {messageMap, messageOrdinals} = useConversationThreadSelector(
    C.useShallow(s => ({
      messageMap: s.messageMap,
      messageOrdinals: s.messageOrdinals,
    }))
  )
  const {team, teamID, tlfname} = useThreadMeta(
    C.useShallow(m => ({team: m.teamname, teamID: m.teamID, tlfname: m.tlfname}))
  )
  const participantInfo = useConversationParticipants(conversationIDKey)
  const blockButtonInfo = useBlockButtonsInfo(teamID)
  const currentUser = useCurrentUserState(s => s.username)
  const hasOwnMessage =
    !!currentUser &&
    [...(messageOrdinals ?? [])].some(ordinal => messageMap.get(ordinal)?.author === currentUser)

  React.useEffect(() => {
    if (hasOwnMessage && blockButtonInfo && teamID) {
      dismissBlockButtons(teamID)
    }
  }, [blockButtonInfo, hasOwnMessage, teamID])

  if (!blockButtonInfo) {
    return null
  }
  const adder = blockButtonInfo.adder
  const others = (team ? participantInfo.all : participantInfo.name).filter(
    person => person !== currentUser && person !== adder && !isAssertion(person)
  )

  const onViewProfile = () => navToProfile(adder)
  const onViewTeam = () => navigateAppend({name: 'team', params: {teamID}})
  const onBlock = () =>
    navigateAppend({
      name: 'chatBlockingModal',
      params: {
        blockUserByDefault: true,
        conversationIDKey,
        others: others,
        team: team,
        username: adder,
      },
    })
  const onDismiss = () => dismissBlockButtons(teamID)

  const buttonRow = (
    <Kb.ButtonBar
      fullWidth={isMobile}
      direction={isMobile ? 'column' : 'row'}
      style={styles.button}
    >
      <Kb.WaveButton
        small={true}
        conversationIDKey={conversationIDKey}
        tlfName={tlfname}
        toMany={others.length > 0 || !!team}
        style={styles.waveButton}
      />
      {!team && others.length === 0 ? (
        <Kb.Button
          label="View profile"
          style={styles.button}
          small={true}
          mode="Secondary"
          onClick={onViewProfile}
        />
      ) : null}
      {team ? (
        <Kb.Button
          label="View team"
          style={styles.button}
          mode="Secondary"
          small={true}
          onClick={onViewTeam}
        />
      ) : null}
      <Kb.Button
        label="Block"
        type="Danger"
        mode="Secondary"
        style={styles.button}
        small={true}
        onClick={onBlock}
      />
    </Kb.ButtonBar>
  )
  return isMobile ? (
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      gap="tiny"
      relative={true}
      style={styles.dismissContainer}
      fullWidth={true}
    >
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} centerChildren={true}>
        <Kb.Text type="BodySmall">
          {team ? `${adder} added you to this team.` : `You don't follow ${adder}.`}
        </Kb.Text>
        <Kb.Icon
          style={styles.dismissIcon}
          type="iconfont-close"
          color={Kb.Styles.globalColors.black_20}
          onClick={onDismiss}
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true} style={styles.buttonContainer}>
        {buttonRow}
      </Kb.Box2>
    </Kb.Box2>
  ) : (
    <Kb.Box2 direction="horizontal" gap="xsmall" alignItems="center" style={styles.container}>
      <Kb.Text type="BodySmall">
        {team ? `${adder} added you to this team.` : `You don't follow ${adder}.`}
      </Kb.Text>
      {buttonRow}
      <Kb.Icon type="iconfont-remove" onClick={onDismiss} />
    </Kb.Box2>
  )
}

export default BlockButtons

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: Kb.Styles.platformStyles({
        isElectron: {
          width: '',
        },
        isMobile: {
          ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
        },
      }),
      buttonContainer: {maxWidth: 322},
      container: {
        alignSelf: 'flex-start',
        marginLeft: 57,
      },
      dismissContainer: {
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.xsmall),
      },
      dismissIcon: {
        position: 'absolute',
        right: Kb.Styles.globalMargins.small,
        top: -1,
      },
      waveButton: Kb.Styles.platformStyles({
        isElectron: {
          width: '',
        },
      }),
    }) as const
)
