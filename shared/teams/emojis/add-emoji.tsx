import * as T from '@/constants/types'
import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {AliasInput, Modal} from './common'
import {pickImages} from '@/util/pick-files'
import kebabCase from 'lodash/kebabCase'
import {useEmojiState} from './use-emoji'

const pickEmojisPromise = async () => pickImages('Select emoji images to upload')

type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  teamID: T.Teams.TeamID // not supported yet
}
type RoutableProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  teamID: T.Teams.TeamID // not supported yet
}

// don't prefill on mobile since it's always a long random string.
const filePathToDefaultAlias = Kb.Styles.isMobile
  ? () => ''
  : (path: string) => {
      const name = T.FS.getLocalPathName(path)
      const lastDot = name.lastIndexOf('.')
      return kebabCase(lastDot > 0 ? name.slice(0, lastDot) : name)
    }

const useDoAddEmojis = (
  conversationIDKey: T.Chat.ConversationIDKey,
  emojisToAdd: Array<EmojiToAdd>,
  setErrors: (errors: Map<string, string>) => void,
  removeFilePath: (toRemove: Set<string> | string) => void,
  onChange?: () => void
) => {
  const addEmojisRpc = C.useRPC(T.RPCChat.localAddEmojisRpcPromise)
  const [waitingAddEmojis, setWaitingAddEmojis] = React.useState(false)
  const [bannerError, setBannerError] = React.useState('')
  const clearBannerError = React.useCallback(() => setBannerError(''), [setBannerError])

  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const doAddEmojis =
    conversationIDKey !== C.Chat.noConversationIDKey
      ? () => {
          setWaitingAddEmojis(true)
          addEmojisRpc(
            [
              {
                aliases: emojisToAdd.map(e => e.alias),
                // TODO add plumbing when editing an existing emoji.
                allowOverwrite: emojisToAdd.map(() => false),
                convID: T.Chat.keyToConversationID(conversationIDKey),
                filenames: emojisToAdd.map(e => Kb.Styles.unnormalizePath(e.path)),
              },
            ],
            res => {
              if (res.successFilenames?.length) {
                onChange?.()
                removeFilePath(new Set(res.successFilenames))
              }
              const failedFilenamesKeys = Object.keys(res.failedFilenames ?? {})
              !failedFilenamesKeys.length && clearModals()
              setErrors(
                new Map(failedFilenamesKeys.map(key => [key, res.failedFilenames?.[key]?.uidisplay ?? '']))
              )
              setBannerError(`Failed to add ${failedFilenamesKeys.length} emoji.`)
              setWaitingAddEmojis(false)
            },
            err => {
              throw err
            }
          )
        }
      : undefined
  return {bannerError, clearBannerError, doAddEmojis, waitingAddEmojis}
}

const useStuff = (conversationIDKey: T.Chat.ConversationIDKey, onChange?: () => void) => {
  const [filePaths, setFilePaths] = React.useState<Array<string>>([])

  const [aliasMap, setAliasMap] = React.useState(new Map<string, string>())

  const addFiles = React.useCallback(
    (paths: Array<string>) => {
      const pathsToAdd = paths.reduce(
        ({deduplicated, set}, path) => {
          if (!set.has(path)) {
            set.add(path)
            deduplicated.push(path)
          }
          return {deduplicated, set}
        },
        {
          deduplicated: [] as Array<string>,
          set: new Set<string>(filePaths),
        }
      ).deduplicated
      setAliasMap(
        pathsToAdd.reduce(
          (map: Map<string, string>, path) =>
            map.get(path) ? map : new Map([...map, [path, filePathToDefaultAlias(path)]]),
          aliasMap
        )
      )
      setFilePaths([...filePaths, ...pathsToAdd])
    },
    [filePaths, aliasMap, setFilePaths]
  )
  const clearFiles = React.useCallback(() => setFilePaths([]), [setFilePaths])

  const removeFilePath = React.useCallback(
    (toRemove: Set<string> | string) =>
      setFilePaths(fps =>
        typeof toRemove === 'string'
          ? fps.filter(filePath => toRemove !== filePath)
          : fps.filter(filePath => !toRemove.has(filePath))
      ),
    [setFilePaths]
  )

  const [errors, setErrors] = React.useState(new Map<string, string>())

  const emojisToAdd = React.useMemo(
    () =>
      filePaths.map(path => ({
        alias: aliasMap.get(path) || '',
        error: errors.get(path) || '',
        onChangeAlias: (newAlias: string) => setAliasMap(new Map([...aliasMap, [path, newAlias]])),
        onRemove: () => removeFilePath(path),
        path,
      })),
    [errors, filePaths, aliasMap, removeFilePath]
  )

  const {bannerError, clearBannerError, doAddEmojis, waitingAddEmojis} = useDoAddEmojis(
    conversationIDKey,
    emojisToAdd,
    setErrors,
    removeFilePath,
    onChange
  )
  const clearErrors = React.useCallback(() => {
    clearBannerError()
    setErrors(new Map<string, string>())
  }, [clearBannerError, setErrors])

  return {
    addFiles,
    bannerError,
    clearErrors,
    clearFiles,
    doAddEmojis,
    emojisToAdd,
    removeFilePath,
    waitingAddEmojis,
  }
}

export const AddEmojiModal = (props: Props) => {
  const onChange = useEmojiState(s => s.dispatch.triggerEmojiUpdated)
  const {addFiles, bannerError, clearErrors, clearFiles, doAddEmojis, emojisToAdd, waitingAddEmojis} =
    useStuff(props.conversationIDKey, onChange)

  const pick = () => {
    pickEmojisPromise()
      .then(addFiles)
      .catch(() => {})
  }

  return !emojisToAdd.length ? (
    <Modal
      title="Add emoji"
      bannerImage="icon-illustration-emoji-add-460-96"
      desktopHeight={537}
      footerButtonLabel={Kb.Styles.isMobile ? 'Choose Images' : undefined}
      footerButtonOnClick={Kb.Styles.isMobile ? pick : undefined}
    >
      <AddEmojiPrompt addFiles={addFiles} />
    </Modal>
  ) : (
    <Modal
      title="Add emoji"
      bannerError={bannerError}
      bannerImage="icon-illustration-emoji-add-460-96"
      desktopHeight={537}
      footerButtonLabel="Add emoji"
      footerButtonOnClick={doAddEmojis}
      footerButtonWaiting={waitingAddEmojis}
      backButtonOnClick={() => {
        clearErrors()
        clearFiles()
      }}
    >
      <AddEmojiAliasAndConfirm addFiles={addFiles} emojisToAdd={emojisToAdd} />
    </Modal>
  )
}

const AddEmojiModalWrapper = (routableProps: RoutableProps) => {
  const conversationIDKey = routableProps.conversationIDKey
  const teamID = routableProps.teamID
  return <AddEmojiModal conversationIDKey={conversationIDKey} teamID={teamID} />
}

const usePickFiles = (addFiles: (filePaths: Array<string>) => void) => {
  const [dragOver, setDragOver] = React.useState(false)
  const onDragOver = (e: React.DragEvent) => e.dataTransfer.types.includes('Files') && setDragOver(true)
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) {
      return
    }
    const filesToAdd = Array.from(e.dataTransfer.files)
      .filter(file => file.type.startsWith('image/') && typeof file.path === 'string')
      .map(file => file.path)
    filesToAdd.length && addFiles(filesToAdd)
    setDragOver(false)
  }
  const pick = () => {
    pickEmojisPromise()
      .then(addFiles)
      .catch(() => {})
  }
  return {dragOver, onDragLeave, onDragOver, onDrop, pick}
}

type AddEmojiPromptProps = {
  addFiles: (filePaths: Array<string>) => void
}

const AddEmojiPrompt = (props: AddEmojiPromptProps) => {
  const {dragOver, onDragLeave, onDragOver, onDrop, pick} = usePickFiles(props.addFiles)
  return (
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      style={styles.contentContainer}
      gap="small"
    >
      {Kb.Styles.isMobile ? (
        <Kb.Text type="Body" center={true}>
          Choose images from your library
        </Kb.Text>
      ) : (
        <Kb.Box2 direction="vertical">
          <Kb.Text type="Body" center={true}>
            Drag and drop images or
          </Kb.Text>
          <Kb.Text type="Body" center={true}>
            <Kb.Text type="BodyPrimaryLink" onClick={pick}>
              browse your computer
            </Kb.Text>{' '}
            for some.
          </Kb.Text>
        </Kb.Box2>
      )}
      {!Kb.Styles.isMobile && (
        <Kb.Box2
          direction="vertical"
          style={Kb.Styles.collapseStyles([styles.dropArea, dragOver && styles.dropAreaDragOver])}
          centerChildren={true}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <Kb.Icon type="iconfont-emoji" fontSize={48} color={Kb.Styles.globalColors.black_10} />
        </Kb.Box2>
      )}
      <Kb.Text type="BodySmall">Maximum 256KB per image.</Kb.Text>
    </Kb.Box2>
  )
}

type AddEmojiAliasAndConfirmProps = {
  addFiles: (filePaths: Array<string>) => void
  emojisToAdd: Array<EmojiToAdd>
}

type EmojiToAdd = {
  alias: string
  error: string
  onChangeAlias: (newAlias: string) => void
  onRemove: () => void
  path: string
}

type EmojiToAddOrAddRow =
  | {
      type: 'emoji'
      emojiToAdd: EmojiToAdd
      height: number
      key: string
      offset: number
    }
  | {
      type: 'add'
      add: () => any
      height: number
      key: string
      offset: number
    }

const renderRow = (_: number, item: EmojiToAddOrAddRow) =>
  item.type === 'add' ? (
    <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.emojiToAddRow}>
      <Kb.ClickableBox onClick={item.add} style={styles.addEmojiIconContainer}>
        <Kb.Icon type="iconfont-new" color={Kb.Styles.globalColors.blue} />
      </Kb.ClickableBox>
    </Kb.Box2>
  ) : (
    <Kb.Box2
      direction="horizontal"
      gap="xsmall"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([
        styles.emojiToAddRow,
        item.emojiToAdd.error && styles.emojiToAddRowWithError,
      ])}
    >
      <Kb.Box style={styles.emojiToAddImageContainer}>
        <Kb.Image2 src={item.emojiToAdd.path} style={styles.emojiToAddImage} />
      </Kb.Box>
      <AliasInput
        error={item.emojiToAdd.error}
        alias={item.emojiToAdd.alias}
        onChangeAlias={item.emojiToAdd.onChangeAlias}
        onRemove={item.emojiToAdd.onRemove}
        small={true}
      />
    </Kb.Box2>
  )

const AddEmojiAliasAndConfirm = (props: AddEmojiAliasAndConfirmProps) => {
  const {dragOver, onDragLeave, onDragOver, onDrop, pick} = usePickFiles(props.addFiles)
  const {emojisToAdd} = props
  const items = React.useMemo(() => {
    const ret = emojisToAdd.reduce<Array<EmojiToAddOrAddRow>>((arr, emojiToAdd, index) => {
      const previous = arr[index - 1]
      arr.push({
        emojiToAdd,
        height: emojiToAdd.error ? emojiToAddRowHeightWithError : emojiToAddRowHeightNoError,
        key: emojiToAdd.path,
        offset: previous ? previous.offset + previous.height : 0,
        type: 'emoji',
      })
      return arr
    }, [])
    const last = ret.at(-1)
    ret.push({
      add: pick,
      height: emojiToAddRowHeightNoError,
      key: 'btn:add',
      offset: last ? last.offset + last.height : 0,
      type: 'add',
    })
    return ret
  }, [emojisToAdd, pick])

  const [forceLayout, setForceLayout] = React.useState(0)
  React.useEffect(() => setForceLayout(n => n + 1), [emojisToAdd])

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([styles.contentContainer, dragOver && styles.contentContainerDragOver])}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Kb.Text style={styles.textChooseAlias} type="BodySmall">
        {items.length > 1 ? 'Choose aliases for these emoji:' : 'Choose an alias for this emoji:'}
      </Kb.Text>
      <Kb.BoxGrow>
        <Kb.List2
          items={items}
          keyProperty="key"
          renderItem={renderRow}
          itemHeight={{
            getItemLayout: (index: number, item: EmojiToAddOrAddRow | undefined) => ({
              index,
              length: item?.height ?? 0,
              offset: item?.offset ?? 0,
            }),
            type: 'variable',
          }}
          forceLayout={forceLayout}
        />
      </Kb.BoxGrow>
    </Kb.Box2>
  )
}

const emojiToAddRowHeightNoError = Kb.Styles.isMobile ? 48 : 40
const emojiToAddRowHeightWithError = Kb.Styles.isMobile ? 70 : 60

const styles = Kb.Styles.styleSheetCreate(() => ({
  addEmojiIconContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      borderColor: Kb.Styles.globalColors.black_20,
      borderRadius: Kb.Styles.globalMargins.xtiny,
      borderStyle: 'solid',
      borderWidth: 1,
      justifyContent: 'center',
    },
    isElectron: {
      height: Kb.Styles.globalMargins.mediumLarge,
      width: Kb.Styles.globalMargins.mediumLarge,
    },
    isMobile: {
      height: Kb.Styles.globalMargins.large,
      width: Kb.Styles.globalMargins.large,
    },
  }),
  contentContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexGrow,
      backgroundColor: Kb.Styles.globalColors.blueGrey,
      padding: Kb.Styles.globalMargins.small,
    },
  }),
  contentContainerDragOver: Kb.Styles.platformStyles({
    isElectron: {
      opacity: 0.7,
    },
  }),
  dropArea: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.black_05,
      borderColor: Kb.Styles.globalColors.black_35,
      borderRadius: 30,
      borderStyle: 'dotted',
      borderWidth: 3,
      height: 175,
      width: 175,
    },
  }),
  dropAreaDragOver: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.black_10,
    },
  }),
  emojiToAddImage: {
    height: '100%',
    width: '100%',
  },
  emojiToAddImageContainer: Kb.Styles.platformStyles({
    common: {
      backgroundColor: 'white',
    },
    isElectron: {
      borderRadius: Kb.Styles.globalMargins.xxtiny + Kb.Styles.globalMargins.xtiny,
      maxHeight: Kb.Styles.globalMargins.mediumLarge,
      maxWidth: Kb.Styles.globalMargins.mediumLarge,
      minHeight: Kb.Styles.globalMargins.mediumLarge,
      minWidth: Kb.Styles.globalMargins.mediumLarge,
      padding: 3,
    },
    isMobile: {
      borderRadius: Kb.Styles.globalMargins.xtiny,
      maxHeight: Kb.Styles.globalMargins.large,
      maxWidth: Kb.Styles.globalMargins.large,
      minHeight: Kb.Styles.globalMargins.large,
      minWidth: Kb.Styles.globalMargins.large,
      padding: Kb.Styles.globalMargins.xtiny,
    },
  }),
  emojiToAddRow: {
    height: emojiToAddRowHeightNoError,
    paddingBottom: Kb.Styles.globalMargins.tiny,
  },
  emojiToAddRowWithError: {
    height: emojiToAddRowHeightWithError,
  },
  textChooseAlias: {
    marginBottom: Kb.Styles.globalMargins.tiny,
  },
}))

export default AddEmojiModalWrapper
