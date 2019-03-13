// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import {
  Box,
  ClickableBox,
  Icon,
  Text,
  FloatingMenu,
  OverlayParentHOC,
  WithTooltip,
  type OverlayParentProps,
} from '../../common-adapters'
import StaticBreadcrumb from '../common/static-breadcrumb'

type AddNewProps = {
  pathElements: Array<string>,

  openAndUploadBoth?: () => void,
  openAndUploadFile?: () => void,
  openAndUploadDir?: () => void,
  pickAndUploadMixed?: () => void,
  pickAndUploadPhoto?: () => void,
  pickAndUploadVideo?: () => void,
  newFolderRow?: () => void,
}

const propsToMenuItems = (props: AddNewProps) => {
  const items = []
  props.openAndUploadBoth &&
    items.push({
      icon: 'iconfont-upload',
      onClick: props.openAndUploadBoth,
      title: 'Upload a file or folder',
    })
  props.openAndUploadFile &&
    items.push({
      icon: 'iconfont-upload',
      onClick: props.openAndUploadFile,
      title: 'Upload a file',
    })
  props.openAndUploadDir &&
    items.push({
      icon: 'iconfont-upload',
      onClick: props.openAndUploadDir,
      title: 'Upload a folder',
    })
  props.openAndUploadFile && props.openAndUploadDir && items.push('Divider')
  props.pickAndUploadMixed &&
    items.push({
      icon: 'iconfont-upload',
      onClick: props.pickAndUploadMixed,
      title: 'Upload an image or video',
    })
  props.pickAndUploadPhoto &&
    items.push({
      icon: 'iconfont-upload',
      onClick: props.pickAndUploadPhoto,
      title: 'Upload an image',
    })
  props.pickAndUploadVideo &&
    items.push({
      icon: 'iconfont-upload',
      onClick: props.pickAndUploadVideo,
      title: 'Upload a video',
    })
  props.pickAndUploadPhoto && props.pickAndUploadVideo && items.push('Divider')
  items.push({icon: 'iconfont-folder-new', onClick: props.newFolderRow, title: 'Create new folder'})

  return Styles.isMobile
    ? items.map(item =>
        item === 'Divider'
          ? 'Divider'
          : {
              onClick: item.onClick,
              title: item.title,
            }
      )
    : items.map(item =>
        item === 'Divider'
          ? 'Divider'
          : {
              onClick: item.onClick,
              title: item.title,
              view: (
                <Box style={styles.box}>
                  <Icon type={item.icon} color={Styles.globalColors.blue} />
                  <Text type="Body" style={styles.text}>
                    {item.title}
                  </Text>
                </Box>
              ),
            }
      )
}

const AddNew = (props: AddNewProps & OverlayParentProps) => {
  return (
    !!props.newFolderRow && (
      <>
        <WithTooltip text="Upload or create">
          <ClickableBox style={styles.addNew} onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
            <Icon type="iconfont-new" color={Styles.globalColors.blue} style={styles.iconNew} />
            {!Styles.isMobile && (
              <Text type="BodyBigLink" style={styles.text}>
                New ...
              </Text>
            )}
          </ClickableBox>
        </WithTooltip>
        <FloatingMenu
          attachTo={props.getAttachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          header={
            Styles.isMobile
              ? {
                  title: 'header',
                  view: (
                    <Box style={styles.padBreadcrumbHeader}>
                      <StaticBreadcrumb
                        pathElements={props.pathElements}
                        showTlfTypeIcon={true}
                        includeLast={true}
                      />
                    </Box>
                  ),
                }
              : undefined
          }
          items={propsToMenuItems(props)}
          position="bottom center"
          closeOnSelect={true}
        />
      </>
    )
  )
}

export default OverlayParentHOC(AddNew)

const styles = Styles.styleSheetCreate({
  addNew: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small - 4,
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  box: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  iconNew: Styles.platformStyles({
    isMobile: {fontSize: 22},
  }),
  padBreadcrumbHeader: {
    paddingBottom: Styles.globalMargins.medium,
    paddingTop: Styles.globalMargins.medium,
  },
  text: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
    },
    isElectron: {
      // Disable text-decoration: underline on hover for BodyBigLink
      pointerEvents: 'none',
    },
  }),
})
