import * as React from 'react'
import * as TeamsTypes from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as FsTypes from '../../constants/types/fs'
import pickFiles from '../../util/pick-files'
import kebabCase from 'lodash/kebabCase'

type Props = {
  teamID: TeamsTypes.TeamID
}

const AddEmojiModal = (props: Props) => {
  const [filesToAdd, setFilesToAdd] = React.useState<Array<string>>([])
  console.log({songgao: 'AddEmoji', filesToAdd})
  const pick = () => pickFiles().then(props.setFilesToAdd)
  return !filesToAdd.length ? (
    <Modal
      footerButtonLabel={Styles.isMobile ? 'Choose Images' : 'Continue'}
      footerButtonOnClick={
        Styles.isMobile && false
          ? pick
          : () => setFilesToAdd([...Array(20).keys()].map(() => '/private/tmp/hot-potato.gif'))
      }
    >
      <AddEmojiPrompt setFilesToAdd={setFilesToAdd} />
    </Modal>
  ) : (
    <Modal
      footerButtonLabel="Add emoji"
      footerButtonOnClick={() => {}}
      backButtonOnClick={() => setFilesToAdd([])}
    >
      <AddEmojiAliasAndConfirm filesToAdd={filesToAdd} />
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

type AddEmojiPromp = {
  setFilesToAdd: (filePaths: Array<string>) => void
}
const AddEmojiPrompt = (props: AddEmojiPromp) => {
  const [dragOver, setDragOver] = React.useState(false)
  const onDrop = e => {
    if (!e.dataTransfer.types.includes('Files')) {
      return
    }
    const filesToAdd = [...e.dataTransfer.files].filter(
      file => file.type.startsWith('image/') && typeof file.path === 'string'
    )
    filesToAdd.length && props.setFilesToAdd(filesToAdd)
  }
  const pick = () => pickFiles('Select emoji images to upload').then(props.setFilesToAdd)
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
          onDragOver={e => e.dataTransfer.types.includes('Files') && setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
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
  filesToAdd: Array<string>
}

type FileToAddRow = {
  alias: string
  error: string
  height: number
  offset: number
  path: string
  onChangeAlias: (newAlias: string) => void
}

const renderRow = (_: number, item: FileToAddRow) => (
  <Kb.Box2 direction="horizontal" gap="xsmall" fullWidth={true} style={styles.fileToAddRow}>
    <Kb.Box style={styles.fileToAddImageContainer}>
      <Kb.Image src={item.path} style={styles.fileToAddImage} />
    </Kb.Box>
    <Kb.NewInput
      textType={Styles.isMobile ? 'BodySemibold' : 'Body'}
      value={`:${item.alias}:`}
      containerStyle={styles.aliasInput}
      onChangeText={newText => item.onChangeAlias(newText.replace(/:/g, ''))}
    />
  </Kb.Box2>
)

const rowItemHeight = {
  getItemLayout: (index: number, item: FileToAddRow) => ({index, length: item.height, offset: item.offset}),
  type: 'variable',
} as const

const useFileToAddRowItems = (filesToAdd: Array<string>, errors: Array<string>) => {
  const [items, setItems] = React.useState<Array<FileToAddRow>>(
    filesToAdd.reduce((arr, path, index) => {
      const last = arr[arr.length - 1]
      const name = FsTypes.getLocalPathName(path)
      const lastDot = name.lastIndexOf('.')
      const aliasFromName = kebabCase(lastDot > 0 ? name.slice(0, lastDot) : name)
      return [
        ...arr,
        {
          alias: aliasFromName,
          error: errors[index],
          height: errors[index] ? fileToAddRowHeightWithError : fileToAddRowHeightNoError,
          offset: last ? last.offset + last.height : 0,
          onChangeAlias: (newAlias: string) =>
            setItems(oldItems => [
              ...oldItems.slice(0, index),
              {
                ...oldItems[index],
                alias: newAlias,
              },
              ...oldItems.slice(index + 1),
            ]),
          path,
        },
      ]
    }, [] as Array<FileToAddRow>)
  )
  return items
}

const AddEmojiAliasAndConfirm = (props: AddEmojiAliasAndConfirmProps) => {
  const errors = props.filesToAdd.map(() => '') // TODO
  const items = useFileToAddRowItems(props.filesToAdd, errors)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer}>
      <Kb.Text style={styles.textChooseAlias} type="BodySmall">
        Choose aliases for these emojis:
      </Kb.Text>
      <Kb.BoxGrow>
        <Kb.List2 items={items} keyProperty="path" renderItem={renderRow} itemHeight={rowItemHeight} />
      </Kb.BoxGrow>
    </Kb.Box2>
  )
}

const fileToAddRowHeightNoError = Styles.isMobile ? 48 : 40
const fileToAddRowHeightWithError = Styles.isMobile ? 64 : 56

const styles = Styles.styleSheetCreate(() => ({
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
  fileToAddImage: {
    height: '100%',
    width: '100%',
  },
  fileToAddImageContainer: Styles.platformStyles({
    common: {
      backgroundColor: 'white',
      borderRadius: Styles.globalMargins.xtiny,
    },
    isElectron: {
      height: Styles.globalMargins.mediumLarge,
      padding: 3,
      width: Styles.globalMargins.mediumLarge,
    },
    isMobile: {
      height: Styles.globalMargins.large,
      padding: Styles.globalMargins.xtiny,
      width: Styles.globalMargins.large,
    },
  }),
  fileToAddRow: {
    height: fileToAddRowHeightNoError,
    paddingBottom: Styles.globalMargins.tiny,
  },
  fileToAddRowWithError: {
    height: fileToAddRowHeightNoError,
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
