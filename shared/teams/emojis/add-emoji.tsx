import * as React from 'react'
import * as TeamsTypes from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as FsTypes from '../../constants/types/fs'
import pickFiles from '../../util/pick-files'
import kebabCase from 'lodash/kebabCase'

const pickEmojisPromise = () => pickFiles('Select emoji images to upload')

type Props = {
  teamID: TeamsTypes.TeamID
}

const filePathToDefaultAlias = (path: string) => {
  const name = FsTypes.getLocalPathName(path)
  const lastDot = name.lastIndexOf('.')
  return kebabCase(lastDot > 0 ? name.slice(0, lastDot) : name)
}

const useEmojisToAdd = () => {
  const [filePaths, setFilePaths] = React.useState<Array<string>>([])

  const aliasMap = React.useRef(new Map<string, string>()).current
  const [aliasMapChangeCounter, setAliasMapChangeCounter] = React.useState(0)
  const aliasMapChanged = React.useCallback(() => setAliasMapChangeCounter(c => c + 1), [
    setAliasMapChangeCounter,
  ])

  const addFiles = React.useCallback(
    (paths: Array<string>) => {
      paths.forEach(path => aliasMap.get(path) ?? aliasMap.set(path, filePathToDefaultAlias(path)))
      aliasMapChanged()
      setFilePaths([...filePaths, ...paths])
      console.log({songgao: 'addFiles', paths})
    },
    [filePaths, aliasMap, aliasMapChanged, setFilePaths]
  )
  const clearFiles = React.useCallback(() => setFilePaths([]), [setFilePaths])

  const [errors] = React.useState(new Map<string, string>())

  const emojisToAdd = React.useMemo(() => {
    // @ts-ignore
    const makeLinterhappy = aliasMapChangeCounter
    console.log({songgao: 'emojisToAdd', filePaths})

    return filePaths.map(path => ({
      alias: aliasMap.get(path) || '',
      error: errors.get(path) || '',
      onChangeAlias: (newAlias: string) => {
        aliasMap.set(path, newAlias)
        aliasMapChanged()
      },
      path,
    }))
  }, [aliasMapChangeCounter, errors, filePaths, aliasMap, aliasMapChanged])
  return {addFiles, clearFiles, emojisToAdd}
}

const debug = true

const AddEmojiModal = (props: Props) => {
  const {addFiles, clearFiles, emojisToAdd} = useEmojisToAdd()
  const pick = () => pickEmojisPromise().then(addFiles)
  return !emojisToAdd.length ? (
    <Modal
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
      footerButtonLabel="Add emoji"
      footerButtonOnClick={() => {}}
      backButtonOnClick={() => clearFiles([])}
    >
      <AddEmojiAliasAndConfirm addFiles={addFiles} emojisToAdd={emojisToAdd} />
    </Modal>
  )
}

export default AddEmojiModal

type ModalProps = {
  children: React.ReactNode
  footerButtonLabel?: string
  footerButtonOnClick?: () => void
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
        <Kb.Icon type="icon-illustration-emoji-add-460-96" />
        {props.children}
        {props.footerButtonLabel && (
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
    console.log({songgao: 'onDrop', types: e.dataTransfer.types})
    if (!e.dataTransfer.types.includes('Files')) {
      console.log({songgao: 'onDrop not includes', types: e.dataTransfer.types})
      return
    }
    const filesToAdd = [...e.dataTransfer.files]
      .filter(file => file.type.startsWith('image/') && typeof file.path === 'string')
      .map(file => file.path)
    console.log({songgao: 'onDrop', filesToAdd, files: e.dataTransfer.files})
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
      offset: number
    }
  | {
      type: 'add'
      add: () => any
      height: number
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
    <Kb.Box2 direction="horizontal" gap="xsmall" fullWidth={true} style={styles.emojiToAddRow}>
      <Kb.Box style={styles.emojiToAddImageContainer}>
        <Kb.Image src={item.emojiToAdd.path} style={styles.emojiToAddImage} />
      </Kb.Box>
      <Kb.NewInput
        textType={Styles.isMobile ? 'BodySemibold' : 'Body'}
        value={`:${item.emojiToAdd.alias}:`}
        containerStyle={styles.aliasInput}
        onChangeText={newText => item.emojiToAdd.onChangeAlias(newText.replace(/:/g, ''))}
      />
    </Kb.Box2>
  )

const rowItemHeight = {
  getItemLayout: (index: number, item: EmojiToAddOrAddRow) => ({
    index,
    length: item.height,
    offset: item.offset,
  }),
  type: 'variable',
} as const

const AddEmojiAliasAndConfirm = (props: AddEmojiAliasAndConfirmProps) => {
  const {dragOver, onDragLeave, onDragOver, onDrop, pick} = usePickFiles(props.addFiles)
  const {emojisToAdd} = props
  const items = React.useMemo(() => {
    const ret = emojisToAdd.reduce((arr, emojiToAdd, index) => {
      const last = arr[index - 1]
      arr.push({
        emojiToAdd,
        height: emojiToAdd.error ? emojiToAddRowHeightWithError : emojiToAddRowHeightNoError,
        offset: last ? last.offset + last.height : 0,
        type: 'emoji',
      })
      return arr
    }, [] as Array<EmojiToAddOrAddRow>)
    const last = ret[ret.length - 1]
    ret.push({
      add: pick,
      height: emojiToAddRowHeightNoError,
      offset: last ? last.offset + last.height : 0,
      type: 'add',
    })
    return ret
  }, [emojisToAdd, pick])
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
        <Kb.List2 items={items} keyProperty="path" renderItem={renderRow} itemHeight={rowItemHeight} />
      </Kb.BoxGrow>
    </Kb.Box2>
  )
}

const emojiToAddRowHeightNoError = Styles.isMobile ? 48 : 40
const emojiToAddRowHeightWithError = Styles.isMobile ? 64 : 56

const styles = Styles.styleSheetCreate(() => ({
  addEmojiIconContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    borderColor: Styles.globalColors.black_20,
    borderRadius: Styles.globalMargins.xtiny,
    borderStyle: 'solid',
    borderWidth: 1,
    height: Styles.globalMargins.mediumLarge,
    justifyContent: 'center',
    width: Styles.globalMargins.mediumLarge,
  },
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
  container: Styles.platformStyles({
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
      padding: 3,
      maxHeight: Styles.globalMargins.mediumLarge,
      maxWidth: Styles.globalMargins.mediumLarge,
      minHeight: Styles.globalMargins.mediumLarge,
      minWidth: Styles.globalMargins.mediumLarge,
    },
    isMobile: {
      borderRadius: Styles.globalMargins.xtiny,
      height: Styles.globalMargins.large,
      padding: Styles.globalMargins.xtiny,
      width: Styles.globalMargins.large,
    },
  }),
  emojiToAddRow: {
    height: emojiToAddRowHeightNoError,
    paddingBottom: Styles.globalMargins.tiny,
  },
  emojiToAddRowWithError: {
    height: emojiToAddRowHeightNoError,
  },
  footerContainer: Styles.platformStyles({
    isElectron: {
      paddingBottom: Styles.globalMargins.xsmall,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.xsmall,
    },
    isMobile: {
      padding: Styles.globalMargins.small,
    },
  }),
  headerContainer: Styles.platformStyles({
    isElectron: {
      height: Styles.globalMargins.large + Styles.globalMargins.tiny,
      position: 'relative',
    },
  }),
  textChooseAlias: {
    marginBottom: Styles.globalMargins.tiny,
  },
}))
