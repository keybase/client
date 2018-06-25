// @flow
import * as React from 'react'
import {isMobile, globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Box, ClickableBox, Icon, Text, type IconType} from '../../common-adapters'
import StaticBreadcrumb from '../common/static-breadcrumb'
import FloatingMenu, {
  FloatingMenuParentHOC,
  type FloatingMenuParentProps,
} from '../../common-adapters/floating-menu'

type AddNewProps = {
  style?: Object,
  showText: boolean,
  menuItems: Array<{
    onClick: () => void,
    icon: IconType,
    title: string,
  }>,
  pathElements: Array<string>,
}

const AddNew = (props: AddNewProps & FloatingMenuParentProps) => {
  return (
    !!props.menuItems.length && (
      <Box style={props.style}>
        <ClickableBox style={stylesBox} onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
          <Icon type="iconfont-new" color={globalColors.blue} style={stylesIconNew} />
          {!isMobile && (
            <Text type="BodyBigLink" style={stylesText}>
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
          items={props.menuItems.map(({onClick, title, icon}) => ({
            onClick,
            ...(isMobile
              ? {title}
              : {
                  title,
                  view: (
                    <Box style={stylesBox}>
                      <Icon type={icon} color={globalColors.blue} />
                      <Text type="Body" style={stylesText}>
                        {title}
                      </Text>
                    </Box>
                  ),
                }),
          }))}
          position="bottom center"
          closeOnSelect={true}
        />
      </Box>
    )
  )
}

const stylesBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const stylesText = {
  marginLeft: globalMargins.tiny,
}

const stylesIconNew = platformStyles({
  isMobile: {fontSize: 22},
})

export default FloatingMenuParentHOC(AddNew)
