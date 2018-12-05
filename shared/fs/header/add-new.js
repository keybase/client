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

  return isMobile
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
  stylesIconNew: platformStyles({
    isMobile: {fontSize: 22},
  }),
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
})

export default OverlayParentHOC(AddNew)
