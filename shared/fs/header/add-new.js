// @flow
import * as React from 'react'
import {isMobile, globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Box, ClickableBox, Icon, Text, type IconType} from '../../common-adapters'
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
  pathElementsNoKeybase: Array<string>,
}

const getIcon = (tlfType: string): IconType => {
  switch (tlfType) {
    case 'private':
      return 'icon-folder-private-16'
    case 'public':
      return 'icon-folder-public-16'
    case 'team':
      return 'icon-folder-team-16'
    default:
      return 'iconfont-question-mark'
  }
}

const header = (pathElementsNoKeybase: Array<string>) => {
  return !isMobile
    ? undefined
    : {
        title: 'header',
        view: (
          <Box style={stylesHeaderBox}>
            {[
              <Icon
                type={getIcon(pathElementsNoKeybase[0])}
                color={globalColors.blue}
                style={stylesIconFolderType}
                key="icon"
              />,
              <Text key="text" type="BodySmallSemibold">
                {pathElementsNoKeybase[0]}
              </Text>,
              ...[].concat(
                pathElementsNoKeybase.slice(1).map((elem, idx) => [
                  <Icon
                    key={`icon-${idx}`}
                    type="iconfont-arrow-right"
                    style={stylesIconArrow}
                    color={globalColors.black_20}
                    fontSize={12}
                  />,
                  <Text key={`text-${idx}`} type="BodySmallSemibold">
                    {elem}
                  </Text>,
                ])
              ),
            ]}
          </Box>
        ),
      }
}

const AddNew = (props: AddNewProps & FloatingMenuParentProps) => {
  return !props.menuItems.length ? null : (
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
        header={header(props.pathElementsNoKeybase)}
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
}

const stylesBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const stylesHeaderBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  padding: globalMargins.tiny,
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const stylesText = {
  marginLeft: globalMargins.tiny,
}

const stylesIconFolderType = {
  marginRight: globalMargins.xtiny,
}

const stylesIconArrow = {
  paddingLeft: 2,
  paddingRight: 2,
  alignSelf: 'flex-end',
}

const stylesIconNew = platformStyles({
  isMobile: {fontSize: 22},
})

export default FloatingMenuParentHOC(AddNew)
