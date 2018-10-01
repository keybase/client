// @flow
import * as React from 'react'
import {
  isMobile,
  styleSheetCreate,
  collapseStyles,
  globalStyles,
  globalColors,
  globalMargins,
  platformStyles,
} from '../../styles'
import {
  Box,
  ClickableBox,
  Icon,
  Text,
  FloatingMenu,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../common-adapters'
import StaticBreadcrumb from '../common/static-breadcrumb'

type AddNewProps = {
  style?: Object,
  showText: boolean,
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
      title: 'Upload a file or folder',
      onClick: props.openAndUploadBoth,
      icon: 'iconfont-upload',
    })
  props.openAndUploadFile &&
    items.push({
      title: 'Upload a file',
      onClick: props.openAndUploadFile,
      icon: 'iconfont-upload',
    })
  props.openAndUploadDir &&
    items.push({
      title: 'Upload a folder',
      onClick: props.openAndUploadDir,
      icon: 'iconfont-upload',
    })
  props.openAndUploadFile && props.openAndUploadDir && items.push('Divider')
  props.pickAndUploadMixed &&
    items.push({
      title: 'Upload an image or video',
      onClick: props.pickAndUploadMixed,
      icon: 'iconfont-upload',
    })
  props.pickAndUploadPhoto &&
    items.push({
      title: 'Upload an image',
      onClick: props.pickAndUploadPhoto,
      icon: 'iconfont-upload',
    })
  props.pickAndUploadVideo &&
    items.push({
      title: 'Upload a video',
      onClick: props.pickAndUploadVideo,
      icon: 'iconfont-upload',
    })
  props.pickAndUploadPhoto && props.pickAndUploadVideo && items.push('Divider')
  items.push({title: 'Create new folder', onClick: props.newFolderRow, icon: 'iconfont-folder-new'})

  return isMobile
    ? items.map(
        item =>
          item === 'Divider'
            ? 'Divider'
            : {
                title: item.title,
                onClick: item.onClick,
              }
      )
    : items.map(
        item =>
          item === 'Divider'
            ? 'Divider'
            : {
                onClick: item.onClick,
                title: item.title,
                view: (
                  <Box style={styles.stylesBox}>
                    <Icon type={item.icon} color={globalColors.blue} />
                    <Text type="Body" style={styles.stylesText}>
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
      <Box>
        <ClickableBox style={props.style} onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
          <Icon
            type="iconfont-new"
            color={globalColors.blue}
            style={collapseStyles([styles.stylesIconNew])}
          />
          {!isMobile && (
            <Text type="BodyBigLink" style={styles.stylesText}>
              New ...
            </Text>
          )}
        </ClickableBox>
        <FloatingMenu
          attachTo={props.getAttachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          header={
            isMobile
              ? {
                  title: 'header',
                  view: (
                    <Box style={styles.stylesPadBreadcrumbHeader}>
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
      </Box>
    )
  )
}

const styles = styleSheetCreate({
  stylesBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  stylesPadBreadcrumbHeader: {paddingBottom: globalMargins.medium, paddingTop: globalMargins.medium},
  stylesText: platformStyles({
    common: {
      marginLeft: globalMargins.tiny,
    },
    isElectron: {
      // Disable text-decoration: underline on hover for BodyBigLink
      pointerEvents: 'none',
    },
  }),
  stylesIconNew: platformStyles({
    isMobile: {fontSize: 22},
  }),
})

export default OverlayParentHOC(AddNew)
