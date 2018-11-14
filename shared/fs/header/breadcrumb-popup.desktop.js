// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {
  ClickableBox,
  Icon,
  Box,
  Text,
  FloatingMenu,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../common-adapters'
import {globalMargins, globalStyles} from '../../styles'
import {isMobile} from '../../constants/platform'
import {PathItemIcon} from '../common'

type Props = {
  items: Array<Types.PathBreadcrumbItem>,
}

const BreadcrumbPopup = (props: Props & OverlayParentProps) => (
  <Box>
    <ClickableBox
      style={stylesBreadcrumbDropdownIconBox}
      onClick={props.toggleShowingMenu}
      ref={props.setAttachmentRef}
    >
      <Icon type="iconfont-folder-dropdown" style={styleBreadcrumbDropdownIcon} fontSize={16} />
    </ClickableBox>
    <FloatingMenu
      containerStyle={stylePopup}
      attachTo={props.getAttachmentRef}
      visible={props.showingMenu}
      onHidden={props.toggleShowingMenu}
      items={props.items.map(({onClick, name, iconSpec}) => ({
        onClick,
        title: name,
        view: (
          <Box style={stylesRow}>
            <PathItemIcon spec={iconSpec} style={pathItemIconStyle} small={true} />
            <Text type="Body" lineClamp={1}>
              {name}
            </Text>
          </Box>
        ),
      }))}
      position="bottom right"
      closeOnSelect={true}
    />
  </Box>
)

const stylePopup = {
  width: isMobile ? '100%' : 196,
  marginTop: isMobile ? undefined : 12,
  marginLeft: isMobile ? undefined : -12,
}

const stylesRow = {
  ...globalStyles.flexBoxRow,
}

const pathItemIconStyle = {
  marginBottom: globalMargins.xtiny,
  marginRight: globalMargins.tiny,
}

const stylesBreadcrumbDropdownIconBox = {
  marginTop: 2,
}

const styleBreadcrumbDropdownIcon = {
  marginRight: globalMargins.xtiny,
}

export default OverlayParentHOC(BreadcrumbPopup)
