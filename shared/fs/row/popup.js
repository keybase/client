// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../styles'
import {Box, ClickableBox, Icon, Text, Divider, PopupMenu} from '../../common-adapters'

const Popup = ({routeProps}) => {
  const onHidden = routeProps.get('onHidden')
  const header = ({
    title: 'yo',
    view: (
      <Box style={stylesHeader}>
        <Text type="Body">yo</Text>
      </Box>
    ),
  })
  return <PopupMenu header={header} items={[]} style={stylesContainer} onHidden={onHidden}/>
}

const stylesContainer = {
  width: 220,
  overflow: 'visible',
}

const stylesHeader = {
  ...globalStyles.flexBoxColumn,
  width: '100%',
}

export default Popup
