import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as RPCChatGen from '../../constants/types/rpc-chat-gen'
import * as Container from '../../util/container'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import {EmojiPickerDesktop} from '../../chat/emoji-picker/container'
import {
  type EmojiData,
  type RenderableEmoji,
  emojiDataToRenderableEmoji,
  getEmojiStr,
  renderEmoji,
} from '../../util/emoji'
import {AliasInput, Modal} from './common'
import useRPC from '../../util/use-rpc'
import {useEmojiState} from './use-emoji'
import {usePickerState} from '../../chat/emoji-picker/use-picker'

type Props = {
  conversationIDKey: ChatTypes.ConversationIDKey
  defaultSelected?: EmojiData
}

type ChosenEmoji = {
  emojiStr: string
  renderableEmoji: RenderableEmoji
}

export const AddAliasModal = (props: Props) => {
  const [emoji, setEmoji] = React.useState<ChosenEmoji | undefined>(undefined)
  const [alias, setAlias] = React.useState('')
  const [error, setError] = React.useState<undefined | string>(undefined)

  const aliasInputRef = React.useRef<AliasInput>(null)
  const onChoose = (emojiStr: string, renderableEmoji: RenderableEmoji) => {
    setEmoji({emojiStr, renderableEmoji})
    setAlias(
      emojiStr
        // first merge skin-tone part into name, e.g.
        // ":+1::skin-tone-1:" into ":+1-skin-tone-1:"
        .replace(/::/g, '-')
        // then strip colons.
        .replace(/:/g, '')
    )
    aliasInputRef.current?.focus()
  }

  React.useEffect(
    () =>
      props.defaultSelected &&
      onChoose(getEmojiStr(props.defaultSelected), emojiDataToRenderableEmoji(props.defaultSelected)),
    [props.defaultSelected]
  )

  const dispatch = Container.useDispatch()
  const addAliasRpc = useRPC(RPCChatGen.localAddEmojiAliasRpcPromise)
  const [addAliasWaiting, setAddAliasWaiting] = React.useState(false)

  const refreshEmoji = useEmojiState(s => s.dispatch.triggerEmojiUpdated)

  const doAddAlias = emoji
    ? () => {
        setAddAliasWaiting(true)
        addAliasRpc(
          [
            {
              convID: ChatTypes.keyToConversationID(props.conversationIDKey),
              existingAlias: emoji.emojiStr,
              newAlias: alias,
            },
          ],
          res => {
            setAddAliasWaiting(false)
            if (res.error) {
              setError(res.error.uidisplay)
              return
            }
            dispatch(RouteTreeGen.createClearModals())
            refreshEmoji()
          },
          err => {
            throw err
          }
        )
      }
    : undefined

  return (
    <Modal
      bannerImage="icon-illustration-emoji-alias-460-96"
      title="Add an alias"
      desktopHeight={395}
      footerButtonLabel="Add an alias"
      footerButtonOnClick={doAddAlias}
      footerButtonWaiting={addAliasWaiting}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Text type="BodySemibold">Choose an existing emoji:</Kb.Text>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="small">
            <SelectedEmoji chosen={emoji} />
            <ChooseEmoji conversationIDKey={props.conversationIDKey} onChoose={onChoose} />
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          gap="tiny"
          style={Styles.collapseStyles([!emoji && styles.opacity40])}
        >
          <Kb.Text type="BodySemibold">Enter an alias:</Kb.Text>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <AliasInput
              ref={aliasInputRef}
              error={error}
              disabled={!emoji}
              alias={alias}
              onChangeAlias={setAlias}
              onEnterKeyDown={doAddAlias}
              small={false}
            />
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Modal>
  )
}

type ChooseEmojiProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  onChoose: (emojiStr: string, renderableEmoji: RenderableEmoji) => void
}
const ChooseEmoji = Styles.isMobile
  ? (props: ChooseEmojiProps) => {
      const dispatch = Container.useDispatch()
      const pickKey = 'addAlias'
      const {emojiStr, renderableEmoji} = usePickerState(s => s.pickerMap.get(pickKey)) ?? {
        emojiStr: '',
        renderableEmoji: {},
      }
      const updatePickerMap = usePickerState(s => s.updatePickerMap)

      const [lastEmoji, setLastEmoji] = React.useState('')
      if (lastEmoji !== emojiStr) {
        setTimeout(() => {
          setLastEmoji(emojiStr)
          emojiStr && props.onChoose(emojiStr, renderableEmoji)
          updatePickerMap(pickKey, undefined)
        }, 1)
      }

      const openEmojiPicker = () =>
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {
                props: {
                  conversationIDKey: props.conversationIDKey,
                  hideFrequentEmoji: true,
                  onlyTeamCustomEmoji: true,
                  pickKey,
                  small: true,
                },
                selected: 'chatChooseEmoji',
              },
            ] as const,
          })
        )
      return <Kb.Button mode="Secondary" label="Choose emoji" onClick={openEmojiPicker} />
    }
  : (props: ChooseEmojiProps) => {
      const {onChoose, conversationIDKey} = props
      const makePopup = React.useCallback(
        (p: Kb.Popup2Parms) => {
          const {attachTo, toggleShowingPopup} = p
          return (
            <Kb.FloatingBox
              attachTo={attachTo}
              containerStyle={{paddingTop: Styles.globalMargins.tiny}}
              position="bottom left"
              onHidden={toggleShowingPopup}
              propagateOutsideClicks={false}
            >
              <EmojiPickerDesktop
                conversationIDKey={conversationIDKey}
                hideFrequentEmoji={true}
                small={false}
                onPickAction={onChoose}
                onDidPick={toggleShowingPopup}
                onlyTeamCustomEmoji={true}
              />
            </Kb.FloatingBox>
          )
        },
        [onChoose, conversationIDKey]
      )
      const {popup, popupAnchor, toggleShowingPopup} = Kb.usePopup2(makePopup)
      return (
        <>
          <Kb.Button mode="Secondary" label="Choose emoji" ref={popupAnchor} onClick={toggleShowingPopup} />
          {popup}
        </>
      )
    }

type SelectedEmojiProps = {
  chosen?: ChosenEmoji
}

const SelectedEmoji = (props: SelectedEmojiProps) => {
  return (
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.emoji}>
      {props.chosen ? (
        renderEmoji({emoji: props.chosen.renderableEmoji, showTooltip: false, size: singleEmojiWidth})
      ) : (
        <Kb.Icon type="iconfont-emoji" fontSize={Styles.isMobile ? 20 : 16} />
      )}
    </Kb.Box2>
  )
}

const emojiWidthWithPadding = Styles.isMobile ? 40 : 32
const emojiPadding = 4
const singleEmojiWidth = emojiWidthWithPadding - 2 * emojiPadding

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexGrow,
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {
      padding: Styles.globalMargins.small,
    },
    isMobile: {
      ...Styles.globalStyles.flexGrow,
      ...Styles.padding(Styles.globalMargins.medium + Styles.globalMargins.xtiny, Styles.globalMargins.small),
    },
  }),
  emoji: {
    backgroundColor: Styles.globalColors.white,
    borderRadius: Styles.globalMargins.xtiny,
    height: emojiWidthWithPadding,
    width: emojiWidthWithPadding,
  },
  opacity40: {
    opacity: 0.4,
  },
}))

const AddEmojiAliasWrapper = (p: Props) => {
  const conversationIDKey = p.conversationIDKey ?? ChatConstants.noConversationIDKey
  const defaultSelected = p.defaultSelected
  return <AddAliasModal conversationIDKey={conversationIDKey} defaultSelected={defaultSelected} />
}
export default AddEmojiAliasWrapper
