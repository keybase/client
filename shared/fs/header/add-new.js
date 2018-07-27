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
import {Box, ClickableBox, Icon, Text, type IconType} from '../../common-adapters'
import StaticBreadcrumb from '../common/static-breadcrumb'
import FloatingMenu, {
  FloatingMenuParentHOC,
  type FloatingMenuParentProps,
} from '../../common-adapters/floating-menu'

type AddNewProps = {
  style?: Object,
  showText: boolean,
  menuItems: Array<
    | {
        onClick: () => void,
        icon: IconType,
        title: string,
      }
    | 'Divider'
  >,
  pathElements: Array<string>,
}

const AddNew = (props: AddNewProps & FloatingMenuParentProps) => {
  return (
    !!props.menuItems.length && (
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
          attachTo={props.attachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          header={
            isMobile
              ? {
                  title: 'header',
                  view: (
                    <StaticBreadcrumb
                      pathElements={props.pathElements}
                      showTlfTypeIcon={true}
                      includeLast={true}
                    />
                  ),
                }
              : undefined
          }
          items={props.menuItems.map(
            item =>
              item === 'Divider'
                ? 'Divider'
                : {
                    onClick: item.onClick,
                    ...(isMobile
                      ? {title: item.title}
                      : {
                          title: item.title,
                          view: (
                            <Box style={styles.stylesBox}>
                              <Icon type={item.icon} color={globalColors.blue} />
                              <Text type="Body" style={styles.stylesText}>
                                {item.title}
                              </Text>
                            </Box>
                          ),
                        }),
                  }
          )}
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
  stylesText: {
    marginLeft: globalMargins.tiny,
  },
  stylesIconNew: platformStyles({
    isMobile: {fontSize: 22},
  }),
})

export default FloatingMenuParentHOC(AddNew)
