import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {EmojiPickerDesktop} from '@/chat/emoji-picker/container'
import {
  type RenderableEmoji,
  emojiDataToRenderableEmoji,
  getEmojiStr,
  type EmojiData,
} from '@/common-adapters/emoji'
import {AliasInput, Modal, type AliasRef} from './common'
import {useEmojiState} from './use-emoji'
import {usePickerState} from '@/chat/emoji-picker/use-picker'

type Props = {defaultSelected?: EmojiData}

type ChosenEmoji = {
  emojiStr: string
  renderableEmoji: RenderableEmoji
}

const AddAliasModal = (props: Props) => {
  const {defaultSelected} = props
  const [emoji, setEmoji] = React.useState<ChosenEmoji | undefined>(undefined)
  const [alias, setAlias] = React.useState('')
  const [error, setError] = React.useState<undefined | string>(undefined)
  const conversationIDKey = Chat.useChatContext(s => s.id)

  const aliasInputRef = React.useRef<AliasRef>(null)
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
      defaultSelected && onChoose(getEmojiStr(defaultSelected), emojiDataToRenderableEmoji(defaultSelected)),
    [defaultSelected]
  )

  const addAliasRpc = C.useRPC(T.RPCChat.localAddEmojiAliasRpcPromise)
  const [addAliasWaiting, setAddAliasWaiting] = React.useState(false)

  const refreshEmoji = useEmojiState(s => s.dispatch.triggerEmojiUpdated)

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const doAddAlias = emoji
    ? () => {
        setAddAliasWaiting(true)
        addAliasRpc(
          [
            {
              convID: T.Chat.keyToConversationID(conversationIDKey),
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
      footerButtonOnClick={alias.length > 2 ? doAddAlias : undefined}
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
      const conversationIDKey = Chat.useChatContext(s => s.id)
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
          const {attachTo, hidePopup} = p
          return (
            <Kb.FloatingBox
              attachTo={attachTo}
              containerStyle={{paddingTop: Kb.Styles.globalMargins.tiny}}
              position="bottom left"
              onHidden={hidePopup}
              propagateOutsideClicks={false}
            >
              <EmojiPickerDesktop
                hideFrequentEmoji={true}
                small={false}
                onPickAction={onChoose}
                onDidPick={hidePopup}
                onlyTeamCustomEmoji={true}
              />
            </Kb.FloatingBox>
          )
        },
        [onChoose]
      )
      const {popup, popupAnchor, showPopup} = Kb.usePopup2(makePopup)
      return (
        <>
          <Kb.Button mode="Secondary" label="Choose emoji" ref={popupAnchor} onClick={showPopup} />
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
        <Kb.Emoji emoji={props.chosen.renderableEmoji} showTooltip={false} size={singleEmojiWidth} />
      ) : (
        <Kb.Icon type="iconfont-emoji" fontSize={Kb.Styles.isMobile ? 20 : 16} />
      )}
    </Kb.Box2>
  )
}

const emojiWidthWithPadding = Kb.Styles.isMobile ? 40 : 32
const singleEmojiWidth = Kb.Styles.isMobile ? (24 as const) : (16 as const)

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

export default AddAliasModal
