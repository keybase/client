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
import {pluralize} from '../../util/string'
import useRPC from '../../util/use-rpc'
import pickFiles from '../../util/pick-files'
import kebabCase from 'lodash/kebabCase'

const pickEmojisPromise = () => pickFiles('Select emoji images to upload')

type Props = {
  conversationIDKey: ChatTypes.ConversationIDKey
  teamID: TeamsTypes.TeamID // not supported yet
}
type RoutableProps = Container.RouteProps<Props>

const filePathToDefaultAlias = (path: string) => {
  const name = FsTypes.getLocalPathName(path)
  const lastDot = name.lastIndexOf('.')
  return kebabCase(lastDot > 0 ? name.slice(0, lastDot) : name)
}

const useDoAddEmojis = (
  conversationIDKey: ChatTypes.ConversationIDKey,
  emojisToAdd: Array<EmojiToAdd>,
  setErrors: (errors: Map<string, string>) => void,
  removeFilePath: (toRemove: Set<string> | string) => void
) => {
  const dispatch = Container.useDispatch()
  const addEmojisRpc = useRPC(RPCChatGen.localAddEmojisRpcPromise)
  const [waitingAddEmojis, setWaitingAddEmojis] = React.useState(false)
  const [bannerError, setBannerError] = React.useState('')
  const doAddEmojis =
    conversationIDKey !== ChatConstants.noConversationIDKey
      ? () => {
          setWaitingAddEmojis(true)
          addEmojisRpc(
            [
              {
                aliases: emojisToAdd.map(e => e.alias),
                convID: ChatTypes.keyToConversationID(conversationIDKey),
                filenames: emojisToAdd.map(e => e.path),
              },
            ],
            res => {
              const failedFilenamesKeys = Object.keys(res.failedFilenames || {})

              if (!failedFilenamesKeys.length) {
                dispatch(RouteTreeGen.createClearModals())
              }

              res.successFilenames && removeFilePath(new Set(res.successFilenames))
              setErrors(new Map(failedFilenamesKeys.map(key => [key, res.failedFilenames[key]])))
              setBannerError(
                `Failed to add ${failedFilenamesKeys.length} ${pluralize(
                  'emojis',
                  failedFilenamesKeys.length
                )}.`
              )
              setWaitingAddEmojis(false)
            },
            err => {
              throw err
            }
          )
        }
      : undefined
  return {bannerError, doAddEmojis, waitingAddEmojis}
}

const useStuff = (conversationIDKey: ChatTypes.ConversationIDKey) => {
  const [filePaths, setFilePaths] = React.useState<Array<string>>([])

  const [aliasMap, setAliasMap] = React.useState(new Map<string, string>())

  const addFiles = React.useCallback(
    (paths: Array<string>) => {
      setAliasMap(
        paths.reduce(
          (map: Map<string, string>, path) =>
            map.get(path) ? map : new Map([...map, [path, filePathToDefaultAlias(path)]]),
          aliasMap
        )
      )
      setFilePaths([...filePaths, ...paths])
    },
    [filePaths, aliasMap, setFilePaths]
  )
  const clearFiles = React.useCallback(() => setFilePaths([]), [setFilePaths])

  const removeFilePath = React.useCallback(
    (toRemove: Set<string> | string) =>
      setFilePaths(filePaths =>
        typeof toRemove === 'string'
          ? filePaths.filter(filePath => toRemove !== filePath)
          : filePaths.filter(filePath => !toRemove.has(filePath))
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
        path,
      })),
    [errors, filePaths, aliasMap]
  )

  const {bannerError, doAddEmojis, waitingAddEmojis} = useDoAddEmojis(
    conversationIDKey,
    emojisToAdd,
    setErrors,
    removeFilePath
  )

  return {
    addFiles,
    bannerError,
    clearFiles,
    doAddEmojis,
    emojisToAdd,
    removeFilePath,
    waitingAddEmojis,
  }
}

const debug = false

export const AddEmojiModal = (props: Props) => {
  const {addFiles, bannerError, clearFiles, doAddEmojis, emojisToAdd, waitingAddEmojis} = useStuff(
    props.conversationIDKey
  )
  const pick = () => pickEmojisPromise().then(addFiles)
  return !emojisToAdd.length ? (
    <Modal
      bannerError=""
      footerButtonLabel={Styles.isMobile ? 'Choose Images' : debug ? 'Add for debug' : undefined}
      footerButtonOnClick={
        Styles.isMobile
          ? pick
          : debug
          ? () => addFiles([...Array(20).keys()].map(() => '/private/tmp/hot-potato.gif'))
          : undefined
      }
    >
      <AddEmojiPrompt addFiles={addFiles} />
    </Modal>
  ) : (
    <Modal
      bannerError={bannerError}
      footerButtonLabel="Add emoji"
      footerButtonOnClick={doAddEmojis}
      footerButtonWaiting={waitingAddEmojis}
      backButtonOnClick={clearFiles}
    >
      <AddEmojiAliasAndConfirm addFiles={addFiles} emojisToAdd={emojisToAdd} />
    </Modal>
  )
}

export default (routableProps: RoutableProps) => {
  const conversationIDKey = Container.getRouteProps(
    routableProps,
    'conversationIDKey',
    ChatConstants.noConversationIDKey
  )
  const teamID = Container.getRouteProps(routableProps, 'teamID', TeamsTypes.noTeamID)
  return <AddEmojiModal conversationIDKey={conversationIDKey} teamID={teamID} />
}

type ModalProps = {
  bannerError: string
  children: React.ReactNode
  footerButtonLabel?: string
  footerButtonOnClick?: () => void
  footerButtonWaiting?: boolean
  backButtonOnClick?: () => void
}

const Modal = (props: ModalProps) => {
  const dispatch = Container.useDispatch()
  const onCancel = () => dispatch(RouteTreeGen.createClearModals())
  return (
    <Kb.PopupWrapper onCancel={onCancel} title="Add emoji">
      <Kb.Box2
        direction="vertical"
        fullHeight={Styles.isMobile}
        fullWidth={Styles.isMobile}
        style={styles.container}
      >
        {!Styles.isMobile && (
          <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.headerContainer}>
            {props.backButtonOnClick && (
              <Kb.Icon
                type="iconfont-arrow-left"
                boxStyle={styles.backButton}
                onClick={props.backButtonOnClick}
              />
            )}
            <Kb.Text type="Header">Add emoji</Kb.Text>
          </Kb.Box2>
        )}
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.bannerContainer}>
          <Kb.Icon type="icon-illustration-emoji-add-460-96" noContainer={true} style={styles.bannerImage} />
          {!!props.bannerError && (
            <Kb.Banner color="red" style={styles.bannerError}>
              {props.bannerError}
            </Kb.Banner>
          )}
        </Kb.Box2>
        {props.children}
        {props.footerButtonLabel && props.footerButtonOnClick && (
          <Kb.Box2
            direction="vertical"
            centerChildren={true}
            style={styles.footerContainer}
            gap="small"
            fullWidth={true}
          >
            <Kb.Button
              mode="Primary"
              label={props.footerButtonLabel}
              fullWidth={true}
              onClick={props.footerButtonOnClick}
              waiting={props.footerButtonWaiting}
            />
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

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
  const pick = () => pickEmojisPromise().then(addFiles)
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
      direction="vertical"
      fullWidth={true}
      gap="xxtiny"
      style={Styles.collapseStyles([
        styles.emojiToAddRow,
        item.emojiToAdd.error && styles.emojiToAddRowWithError,
      ])}
    >
      <Kb.Box2 direction="horizontal" gap="xsmall" fullWidth={true}>
        <Kb.Box style={styles.emojiToAddImageContainer}>
          <Kb.Image src={item.emojiToAdd.path} style={styles.emojiToAddImage} />
        </Kb.Box>
        <Kb.NewInput
          error={!!item.emojiToAdd.error}
          textType={Styles.isMobile ? 'BodySemibold' : 'Body'}
          value={`:${item.emojiToAdd.alias}:`}
          containerStyle={styles.aliasInput}
          onChangeText={newText => item.emojiToAdd.onChangeAlias(newText.replace(/:/g, ''))}
        />
      </Kb.Box2>
      {!!item.emojiToAdd.error && (
        <Kb.Text type="BodySmallError" style={styles.errorText}>
          {item.emojiToAdd.error}
        </Kb.Text>
      )}
    </Kb.Box2>
  )

const AddEmojiAliasAndConfirm = (props: AddEmojiAliasAndConfirmProps) => {
  const {dragOver, onDragLeave, onDragOver, onDrop, pick} = usePickFiles(props.addFiles)
  const {emojisToAdd} = props
  const items = React.useMemo(() => {
    const ret = emojisToAdd.reduce((arr, emojiToAdd, index) => {
      const previous = arr[index - 1]
      arr.push({
        emojiToAdd,
        height: emojiToAdd.error ? emojiToAddRowHeightWithError : emojiToAddRowHeightNoError,
        key: emojiToAdd.path,
        offset: previous ? previous.offset + previous.height : 0,
        type: 'emoji',
      })
      return arr
    }, [] as Array<EmojiToAddOrAddRow>)
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
        Choose aliases for these emojis:
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
const emojiToAddRowHeightWithError = Styles.isMobile ? 64 : 56

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
  aliasInput: Styles.platformStyles({
    common: {
      flexGrow: 1,
      height: '100%',
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.xsmall,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  backButton: {
    left: Styles.globalMargins.xsmall,
    position: 'absolute',
  },
  bannerContainer: {
    height: Styles.globalMargins.xlarge + Styles.globalMargins.mediumLarge,
    position: 'relative',
  },
  bannerError: Styles.platformStyles({
    common: {
      position: 'absolute',
    },
  }),
  bannerImage: Styles.platformStyles({
    common: {
      height: '100%',
      width: '100%',
    },
    isElectron: {
      objectFit: 'cover',
    },
    isMobile: {
      resizeMode: 'cover',
    },
  }),
  container: Styles.platformStyles({
    common: {
      position: 'relative',
    },
    isElectron: {
      height: 537,
      width: 400,
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
  errorText: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.mediumLarge + Styles.globalMargins.xsmall,
    },
    isMobile: {
      marginLeft: Styles.globalMargins.large + Styles.globalMargins.xsmall,
    },
  }),
  footerContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
    },
    isMobile: {
      padding: Styles.globalMargins.small,
    },
  }),
  headerContainer: Styles.platformStyles({
    isElectron: {
      height: Styles.globalMargins.large + Styles.globalMargins.tiny,
    },
  }),
  textChooseAlias: {
    marginBottom: Styles.globalMargins.tiny,
  },
}))
