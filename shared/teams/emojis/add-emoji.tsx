import * as React from 'react'
import * as TeamsTypes from '../../constants/types/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'

type Props = {
  teamID: TeamsTypes.TeamID
}

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
    <Kb.PopupWrapper onCancel={onCancel}>
      <Kb.Box2 direction="vertical" style={styles.container}>
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

type AddEmojiPromop = {
  setFiles: (filePaths: Array<string>) => void
}
const AddEmojiPrompt = () => {
  const [dragOver, setDragOver] = React.useState(false)
  return (
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      style={styles.contentContainer}
      gap="small"
    >
      <Kb.Box2 direction="vertical">
        <Kb.Text type="Body" center={true}>
          Drag and drop images or
        </Kb.Text>
        <Kb.Text type="Body" center={true}>
          <Kb.Text type="BodyPrimaryLink">browse your computer</Kb.Text> for some.
        </Kb.Text>
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([styles.dropArea, dragOver && styles.dropAreaDragOver])}
        centerChildren={true}
        onDragOver={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
      >
        <Kb.Icon type="iconfont-emoji" fontSize={48} color={Styles.globalColors.black_10} />
      </Kb.Box2>
      <Kb.Text type="BodySmall">Maximum 256KB per image.</Kb.Text>
    </Kb.Box2>
  )
}

const AddEmojiAliasAndConfirm = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer}>
    <Kb.Text style={styles.textChooseAlias} type="BodySmall">
      Choose aliases for these emojis:
    </Kb.Text>
  </Kb.Box2>
)

const AddEmoji = (props: Props) => {
  const [files, setFiles] = React.useState<string[]>([])
  return !files.length ? (
    <Modal footerButtonLabel="Continue" footerButtonOnClick={() => setFiles(['a'])}>
      <AddEmojiPrompt />
    </Modal>
  ) : (
    <Modal
      footerButtonLabel="Add emoji"
      footerButtonOnClick={() => {}}
      backButtonOnClick={() => setFiles([])}
    >
      <AddEmojiAliasAndConfirm />
    </Modal>
  )
}

export default AddEmoji

const styles = Styles.styleSheetCreate(() => ({
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
  footerContainer: Styles.platformStyles({
    isElectron: {
      paddingLeft: Styles.globalMargins.small,
      paddingBottom: Styles.globalMargins.xsmall,
      paddingTop: Styles.globalMargins.xsmall,
      paddingRight: Styles.globalMargins.small,
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
