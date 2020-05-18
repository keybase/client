import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Types from '../../../constants/types/chat2'
import * as Constants from '../../../constants/chat2'
import {Avatars, TeamAvatar} from '../../avatars'
import debounce from 'lodash/debounce'
import logger from '../../../logger'

type Props = Container.RouteProps<{srcConvID: Types.ConversationIDKey; ordinal: Types.Ordinal}>

const TeamPicker = (props: Props) => {
  const srcConvID = Container.getRouteProps(props, 'srcConvID', '')
  const ordinal = Container.getRouteProps(props, 'ordinal', 0)
  const message = Container.useSelector(state => Constants.getMessage(state, srcConvID, ordinal))
  const [term, setTerm] = React.useState('')
  const [results, setResults] = React.useState<Array<RPCChatTypes.ConvSearchHit>>([])
  const [waiting, setWaiting] = React.useState(false)
  const [error, setError] = React.useState('')
  const fwdMsg = Container.useRPC(RPCChatTypes.localForwardMessageNonblockRpcPromise)
  const submit = Container.useRPC(RPCChatTypes.localForwardMessageConvSearchRpcPromise)
  const dispatch = Container.useDispatch()
  const doSearch = React.useCallback(() => {
    setWaiting(true)
    submit(
      [{term}],
      result => {
        setWaiting(false)
        setResults(result ?? [])
      },
      error => {
        setWaiting(false)
        setError('Something went wrong, please try again.')
        logger.info('TeamPicker: error loading search results: ' + error.message)
      }
    )
  }, [term, submit])

  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onSelect = (dstConvID: RPCChatTypes.ConversationID) => {
    if (!message) {
      setError('Something went wrong, please try again.')
      return
    }
    fwdMsg(
      [
        {
          dstConvID,
          identifyBehavior: RPCTypes.TLFIdentifyBehavior.chatGui,
          msgID: message.id,
          srcConvID: Types.keyToConversationID(srcConvID),
        },
      ],
      () => {
        setWaiting(false)
      },
      error => {
        setWaiting(false)
        setError('Something went wrong, please try again.')
        logger.info('TeamPicker: error loading search results: ' + error.message)
      }
    )
    dispatch(RouteTreeGen.createClearModals())
    dispatch(
      Chat2Gen.createPreviewConversation({
        conversationIDKey: Types.conversationIDToKey(dstConvID),
        reason: 'forward',
      })
    )
  }
  React.useEffect(() => {
    doSearch()
  }, [doSearch])

  const renderResult = (index: number, item: RPCChatTypes.ConvSearchHit) => {
    return (
      <Kb.ClickableBox key={index} onClick={() => onSelect(item.convID)}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.results}>
          {item.isTeam ? (
            <TeamAvatar
              isHovered={false}
              isMuted={false}
              isSelected={false}
              teamname={item.name.split('#')[0]}
            />
          ) : (
            <Avatars
              isHovered={false}
              isLocked={false}
              isMuted={false}
              isSelected={false}
              participants={item.parts ?? []}
            />
          )}
          <Kb.Text type="Body" style={{alignSelf: 'center'}}>
            {item.name}
          </Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
    )
  }
  return (
    <Kb.Modal
      onClose={onClose}
      header={{
        leftButton: Styles.isMobile ? (
          <Kb.Text type="BodyBigLink" onClick={onClose}>
            {'Cancel'}
          </Kb.Text>
        ) : (
          undefined
        ),
        title: 'Forward to team or chat',
      }}
    >
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.SearchFilter
            size="full-width"
            icon="iconfont-search"
            placeholderText={`Search chats and teams...`}
            placeholderCentered={true}
            onChange={debounce(setTerm, 200)}
            style={styles.searchFilter}
            focusOnMount={true}
            waiting={waiting}
          />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
          {error.length > 0 ? (
            <Kb.Text type="Body" style={{alignSelf: 'center', color: Styles.globalColors.redDark}}>
              {error}
            </Kb.Text>
          ) : (
            <Kb.List2
              indexAsKey={true}
              items={results}
              itemHeight={{sizeType: 'Large', type: 'fixedListItem2Auto'}}
              renderItem={renderResult}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Modal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        isElectron: {
          height: 450,
        },
      }),
      results: Styles.platformStyles({
        common: {
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.tiny,
        },
      }),
      searchFilter: Styles.platformStyles({
        common: {
          marginBottom: Styles.globalMargins.xsmall,
          marginTop: Styles.globalMargins.tiny,
        },
        isElectron: {
          marginLeft: Styles.globalMargins.small,
          marginRight: Styles.globalMargins.small,
        },
      }),
    } as const)
)

export default TeamPicker
