// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, isMobile, platformStyles} from '../../styles'
import {Box, ClickableBox, Icon, Text} from '../../common-adapters'
import FloatingMenu, {
  FloatingMenuParentHOC,
  type FloatingMenuParentProps,
} from '../../common-adapters/floating-menu'
import {type MenuItem} from '../../common-adapters/popup-menu'
import PathItemIcon from '../common/path-item-icon'
import PathItemInfo from '../common/path-item-info'
import StaticBreadcrumb from '../common/static-breadcrumb'
import {memoize} from 'lodash'

type Props = {
  name: string,
  size: number,
  type: Types.PathType,
  lastModifiedTimestamp: number,
  lastWriter: string,
  childrenFolders: number,
  childrenFiles: number,
  itemStyles: Types.ItemStyles,
  actionIconClassName?: string,
  actionIconFontSize?: number,
  pathElements: Array<string>,
  menuItems: Array<MenuItem | 'Divider' | null>,
}

const PathItemActionHeader = (props: Props) => (
  <Box style={stylesHeader}>
    <PathItemIcon spec={props.itemStyles.iconSpec} style={pathItemIconStyle} />
    <StaticBreadcrumb pathElements={props.pathElements} />
    <Box style={stylesNameTextBox}>
      <Text type="BodySmallSemibold" style={stylesNameText(props.itemStyles.textColor)}>
        {props.name}
      </Text>
    </Box>
    {props.type === 'file' && <Text type="BodySmall">{Constants.humanReadableFileSize(props.size)}</Text>}
    {props.type === 'folder' && (
      <Text type="BodySmall">
        {props.childrenFolders
          ? `${props.childrenFolders} Folder${props.childrenFolders > 1 ? 's' : ''}${
              props.childrenFiles ? ', ' : ''
            }`
          : undefined}
        {props.childrenFiles ? `${props.childrenFiles} File${props.childrenFiles > 1 ? 's' : ''}` : undefined}
      </Text>
    )}
    <PathItemInfo
      lastModifiedTimestamp={props.lastModifiedTimestamp}
      lastWriter={props.lastWriter}
      wrap={true}
    />
  </Box>
)

const PathItemAction = (props: Props & FloatingMenuParentProps) => (
  <Box>
    <ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
      <Icon
        type="iconfont-ellipsis"
        color={globalColors.black_40}
        style={actionIconStyle}
        fontSize={props.actionIconFontSize}
        className={props.actionIconClassName}
      />
    </ClickableBox>
    <FloatingMenu
      containerStyle={stylesFloatingContainer}
      attachTo={props.attachmentRef}
      visible={props.showingMenu}
      onHidden={props.toggleShowingMenu}
      position="bottom right"
      closeOnSelect={true}
      header={{
        title: 'unused',
        view: <PathItemActionHeader {...props} />,
      }}
      items={props.menuItems}
    />
  </Box>
)

const stylesNameText = memoize(color =>
  platformStyles({
    common: {
      color,
      textAlign: 'center',
    },
    isElectron: {
      overflowWrap: 'break-word',
    },
  })
)

const stylesNameTextBox = {
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  width: '100%',
  textAlign: 'center',
}

const pathItemIconStyle = {
  marginBottom: globalMargins.xtiny,
}

const stylesFloatingContainer = {
  width: isMobile ? '100%' : 220,
  overflow: 'visible',
  marginTop: isMobile ? undefined : 12,
}

const stylesHeader = {
  ...globalStyles.flexBoxColumn,
  width: '100%',
  alignItems: 'center',
  paddingTop: globalMargins.small,
}

const actionIconStyle = {
  padding: globalMargins.tiny,
}

export default FloatingMenuParentHOC(PathItemAction)
