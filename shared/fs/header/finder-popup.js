// @flow
import * as React from 'react'
import {ModalLessPopupMenu} from '../../common-adapters/popup-menu'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {type RouteProps} from '../../route-tree/render-route'
import {fileUIName} from '../../constants/platform'
import {globalStyles, globalMargins} from '../../styles'

type PopupMenuProps = RouteProps<
  {
    onHidden: () => void,
    onInstall: () => void,
  },
  {}
>

const FinderPopupMenu = ({routeProps}: PopupMenuProps) => {
  const onInstall = routeProps.get('onInstall')
  const onHidden = routeProps.get('onHidden')

  const headerView = {
    title: '',
    view: (
      <Box style={styleHeader}>
        <Icon
          type="icon-fancy-finder-132-96"
          style={{...styleBoundaryItem, paddingTop: globalMargins.medium}}
        />
        <Text type="BodyBig" style={styleBoundaryItem}>
          Enable Keybase in {fileUIName}?
        </Text>
        <Text type="BodySmall" style={styleBoundaryItem}>
          Get access to your files and folders just like you normally do with your local files. It's encrypted
          and secure.
        </Text>
        <Box
          style={{...styleBoundaryItem, paddingTop: globalMargins.small, paddingBottom: globalMargins.tiny}}
        >
          <Button type="PrimaryGreen" label="Yes, enable" onClick={onInstall} />
        </Box>
      </Box>
    ),
  }

  return <ModalLessPopupMenu header={headerView} items={[]} style={stylePopup} onHidden={onHidden} />
}

const styleBoundaryItem = {
  paddingTop: globalMargins.tiny,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

const styleHeader = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  width: '100%',
}

const stylePopup = {
  width: 220,
  overflow: 'visible',
}

export default FinderPopupMenu
