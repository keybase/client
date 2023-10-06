import * as T from '../../constants/types'
import * as C from '../../constants'
import * as React from 'react'
import * as Kb from '../../common-adapters'
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
  conversationIDKey: T.Chat.ConversationIDKey
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

  const addAliasRpc = useRPC(T.RPCChat.localAddEmojiAliasRpcPromise)
  const [addAliasWaiting, setAddAliasWaiting] = React.useState(false)

  const refreshEmoji = useEmojiState(s => s.dispatch.triggerEmojiUpdated)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const doAddAlias = emoji
    ? () => {
        setAddAliasWaiting(true)
        addAliasRpc(
          [
            {
              convID: T.Chat.keyToConversationID(props.conversationIDKey),
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
            clearModals()
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
            <ChooseEmoji onChoose={onChoose} />
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          gap="tiny"
          style={Kb.Styles.collapseStyles([!emoji && styles.opacity40])}
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
  onChoose: (emojiStr: string, renderableEmoji: RenderableEmoji) => void
}
const ChooseEmoji = Kb.Styles.isMobile
  ? (props: ChooseEmojiProps) => {
      const pickKey = 'addAlias'
      const {emojiStr, renderableEmoji} = usePickerState(s => s.pickerMap.get(pickKey)) ?? {
        emojiStr: '',
        renderableEmoji: {},
      }
      const updatePickerMap = usePickerState(s => s.dispatch.updatePickerMap)

      const [lastEmoji, setLastEmoji] = React.useState('')
      if (lastEmoji !== emojiStr) {
        setTimeout(() => {
          setLastEmoji(emojiStr)
          emojiStr && props.onChoose(emojiStr, renderableEmoji)
          updatePickerMap(pickKey, undefined)
        }, 1)
      }

      const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
      const conversationIDKey = C.useChatContext(s => s.id)
      const openEmojiPicker = () =>
        navigateAppend({
          props: {
            conversationIDKey,
            hideFrequentEmoji: true,
            onlyTeamCustomEmoji: true,
            pickKey,
            small: true,
          },
          selected: 'chatChooseEmoji',
        })
      return <Kb.Button mode="Secondary" label="Choose emoji" onClick={openEmojiPicker} />
    }
  : (props: ChooseEmojiProps) => {
      const {onChoose} = props
      const makePopup = React.useCallback(
        (p: Kb.Popup2Parms) => {
          const {attachTo, toggleShowingPopup} = p
          return (
            <Kb.FloatingBox
              attachTo={attachTo}
              containerStyle={{paddingTop: Kb.Styles.globalMargins.tiny}}
              position="bottom left"
              onHidden={toggleShowingPopup}
              propagateOutsideClicks={false}
            >
              <EmojiPickerDesktop
                hideFrequentEmoji={true}
                small={false}
                onPickAction={onChoose}
                onDidPick={toggleShowingPopup}
                onlyTeamCustomEmoji={true}
              />
            </Kb.FloatingBox>
          )
        },
        [onChoose]
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
        <Kb.Icon type="iconfont-emoji" fontSize={Kb.Styles.isMobile ? 20 : 16} />
      )}
    </Kb.Box2>
  )
}

const emojiWidthWithPadding = Kb.Styles.isMobile ? 40 : 32
const emojiPadding = 4
const singleEmojiWidth = emojiWidthWithPadding - 2 * emojiPadding

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexGrow,
      backgroundColor: Kb.Styles.globalColors.blueGrey,
    },
    isElectron: {
      padding: Kb.Styles.globalMargins.small,
    },
    isMobile: {
      ...Kb.Styles.globalStyles.flexGrow,
      ...Kb.Styles.padding(
        Kb.Styles.globalMargins.medium + Kb.Styles.globalMargins.xtiny,
        Kb.Styles.globalMargins.small
      ),
    },
  }),
  emoji: {
    backgroundColor: Kb.Styles.globalColors.white,
    borderRadius: Kb.Styles.globalMargins.xtiny,
    height: emojiWidthWithPadding,
    width: emojiWidthWithPadding,
  },
  opacity40: {
    opacity: 0.4,
  },
}))

const AddEmojiAliasWrapper = (p: Props) => {
  const conversationIDKey = p.conversationIDKey
  const defaultSelected = p.defaultSelected
  return <AddAliasModal conversationIDKey={conversationIDKey} defaultSelected={defaultSelected} />
}
export default AddEmojiAliasWrapper
