import * as React from 'react'
import * as TeamsTypes from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as RPCChatGen from '../../constants/types/rpc-chat-gen'
import * as Container from '../../util/container'
import * as FsTypes from '../../constants/types/fs'
import * as ChatTypes from '../../constants/types/chat2'
import * as ChatConstants from '../../constants/chat2'
import {AliasInput, Modal} from './common'
import useRPC from '../../util/use-rpc'
import {pickImages} from '../../util/pick-files'
import kebabCase from 'lodash/kebabCase'

const pickEmojisPromise = async () => pickImages('Select emoji images to upload')

type Props = {
  conversationIDKey: ChatTypes.ConversationIDKey
  onChange?: () => void
  teamID: TeamsTypes.TeamID // not supported yet
}
type RoutableProps = Container.RouteProps<'teamAddEmoji'>

// don't prefill on mobile since it's always a long random string.
const filePathToDefaultAlias = Styles.isMobile
  ? () => ''
  : (path: string) => {
      const name = FsTypes.getLocalPathName(path)
      const lastDot = name.lastIndexOf('.')
      return kebabCase(lastDot > 0 ? name.slice(0, lastDot) : name)
    }

const useDoAddEmojis = (
  conversationIDKey: ChatTypes.ConversationIDKey,
  emojisToAdd: Array<EmojiToAdd>,
  setErrors: (errors: Map<string, string>) => void,
  removeFilePath: (toRemove: Set<string> | string) => void,
  onChange?: () => void
) => {
  const dispatch = Container.useDispatch()
  const addEmojisRpc = useRPC(RPCChatGen.localAddEmojisRpcPromise)
  const [waitingAddEmojis, setWaitingAddEmojis] = React.useState(false)
  const [bannerError, setBannerError] = React.useState('')
  const clearBannerError = React.useCallback(() => setBannerError(''), [setBannerError])
  const doAddEmojis =
    conversationIDKey !== ChatConstants.noConversationIDKey
      ? () => {
          setWaitingAddEmojis(true)
          addEmojisRpc(
            [
              {
                aliases: emojisToAdd.map(e => e.alias),
                // TODO add plumbing when editing an existing emoji.
                allowOverwrite: emojisToAdd.map(() => false),
                convID: ChatTypes.keyToConversationID(conversationIDKey),
                filenames: emojisToAdd.map(e => e.path),
              },
            ],
            res => {
              if (res.successFilenames?.length) {
                onChange?.()
                removeFilePath(new Set(res.successFilenames))
              }
              const failedFilenamesKeys = Object.keys(res.failedFilenames || {})
              !failedFilenamesKeys.length && dispatch(RouteTreeGen.createClearModals())
              setErrors(new Map(failedFilenamesKeys.map(key => [key, res.failedFilenames[key].uidisplay])))
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

const useStuff = (conversationIDKey: ChatTypes.ConversationIDKey, onChange?: () => void) => {
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
  const {addFiles, bannerError, clearErrors, clearFiles, doAddEmojis, emojisToAdd, waitingAddEmojis} =
    useStuff(props.conversationIDKey, props.onChange)
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
      footerButtonLabel={Styles.isMobile ? 'Choose Images' : undefined}
      footerButtonOnClick={Styles.isMobile ? pick : undefined}
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
  const conversationIDKey = routableProps.route.params?.conversationIDKey ?? ChatConstants.noConversationIDKey
  const teamID = routableProps.route.params?.teamID ?? TeamsTypes.noTeamID
  const onChange = routableProps.route.params?.onChange ?? undefined
  return <AddEmojiModal conversationIDKey={conversationIDKey} teamID={teamID} onChange={onChange} />
}
export default AddEmojiModalWrapper

const usePickFiles = (addFiles: (filePaths: Array<string>) => void) => {
  const [dragOver, setDragOver] = React.useState(false)
  const onDragOver = e => e.dataTransfer.types.includes('Files') && setDragOver(true)
  const onDragLeave = () => setDragOver(false)
  const onDrop = e => {
    if (!e.dataTransfer.types.includes('Files')) {
      return
    }
    const filesToAdd = [...e.dataTransfer.files]
      .filter(file => file.type.startsWith('image/') && typeof file.path === 'string')
      .map(file => file.path)
    filesToAdd.length && addFiles(filesToAdd)
    setDragOver(false)
  }
  const pick = async () => pickEmojisPromise().then(addFiles)
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
      {Styles.isMobile ? (
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
      {!Styles.isMobile && (
        <Kb.Box2
          direction="vertical"
          style={Styles.collapseStyles([styles.dropArea, dragOver && styles.dropAreaDragOver])}
          centerChildren={true}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <Kb.Icon type="iconfont-emoji" fontSize={48} color={Styles.globalColors.black_10} />
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
        <Kb.Icon type="iconfont-new" color={Styles.globalColors.blue} />
      </Kb.ClickableBox>
    </Kb.Box2>
  ) : (
    <Kb.Box2
      direction="horizontal"
      gap="xsmall"
      fullWidth={true}
      style={Styles.collapseStyles([
        styles.emojiToAddRow,
        item.emojiToAdd.error && styles.emojiToAddRowWithError,
      ])}
    >
      <Kb.Box style={styles.emojiToAddImageContainer}>
        <Kb.Image src={item.emojiToAdd.path} style={styles.emojiToAddImage} />
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
    const last = ret[ret.length - 1]
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
      style={Styles.collapseStyles([styles.contentContainer, dragOver && styles.contentContainerDragOver])}
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

const emojiToAddRowHeightNoError = Styles.isMobile ? 48 : 40
const emojiToAddRowHeightWithError = Styles.isMobile ? 70 : 60

const styles = Styles.styleSheetCreate(() => ({
  addEmojiIconContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      borderColor: Styles.globalColors.black_20,
      borderRadius: Styles.globalMargins.xtiny,
      borderStyle: 'solid',
      borderWidth: 1,
      justifyContent: 'center',
    },
    isElectron: {
      height: Styles.globalMargins.mediumLarge,
      width: Styles.globalMargins.mediumLarge,
    },
    isMobile: {
      height: Styles.globalMargins.large,
      width: Styles.globalMargins.large,
    },
  }),
  contentContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexGrow,
      backgroundColor: Styles.globalColors.blueGrey,
      padding: Styles.globalMargins.small,
    },
  }),
  contentContainerDragOver: Styles.platformStyles({
    isElectron: {
      opacity: 0.7,
    },
  }),
  dropArea: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.black_05,
      borderColor: Styles.globalColors.black_35,
      borderRadius: 30,
      borderStyle: 'dotted',
      borderWidth: 3,
      height: 175,
      width: 175,
    },
  }),
  dropAreaDragOver: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.black_10,
    },
  }),
  emojiToAddImage: {
    height: '100%',
    width: '100%',
  },
  emojiToAddImageContainer: Styles.platformStyles({
    common: {
      backgroundColor: 'white',
    },
    isElectron: {
      borderRadius: Styles.globalMargins.xxtiny + Styles.globalMargins.xtiny,
      maxHeight: Styles.globalMargins.mediumLarge,
      maxWidth: Styles.globalMargins.mediumLarge,
      minHeight: Styles.globalMargins.mediumLarge,
      minWidth: Styles.globalMargins.mediumLarge,
      padding: 3,
    },
    isMobile: {
      borderRadius: Styles.globalMargins.xtiny,
      maxHeight: Styles.globalMargins.large,
      maxWidth: Styles.globalMargins.large,
      minHeight: Styles.globalMargins.large,
      minWidth: Styles.globalMargins.large,
      padding: Styles.globalMargins.xtiny,
    },
  }),
  emojiToAddRow: {
    height: emojiToAddRowHeightNoError,
    paddingBottom: Styles.globalMargins.tiny,
  },
  emojiToAddRowWithError: {
    height: emojiToAddRowHeightWithError,
  },
  textChooseAlias: {
    marginBottom: Styles.globalMargins.tiny,
  },
}))
