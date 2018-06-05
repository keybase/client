// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import rowStyles from './styles'
import {Icon, ClickableBox, Input, Box, Button, Text, Divider} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'

type EditingProps = {
  name: string,
  hint: string,
  status: Types.EditStatusType,
  itemStyles: Types.ItemStyles,
  isCreate: boolean,
  onSubmit: () => void,
  onUpdate: (name: string) => void,
  onCancel: () => void,
}

const Editing = (props: EditingProps) => (
  <Box>
    <Box style={rowStyles.row}>
      <PathItemIcon spec={props.itemStyles.iconSpec} style={rowStyles.pathItemIcon} />
      <Box key="main" style={rowStyles.itemBox}>
        <Input
          hideUnderline={true}
          small={true}
          value={props.name}
          hintText={props.hint}
          inputStyle={stylesText}
          onEnterKeyDown={props.onSubmit}
          onChangeText={name => props.onUpdate(name)}
          autoFocus={true}
          selectTextOnFocus={true}
        />
      </Box>
      <Box key="right" style={rowStyles.rightBox}>
        {props.status === 'failed' && <Text type="BodyError">Failed</Text>}
        <Button
          key="create"
          style={stylesButton}
          type="Primary"
          small={true}
          label={props.status === 'failed' ? 'Retry' : props.isCreate ? 'Create' : 'Save'}
          waiting={props.status === 'saving'}
          onClick={props.status === 'saving' ? undefined : props.onSubmit}
        />
        <ClickableBox style={stylesCancelBox} onClick={props.onCancel}>
          <Icon type="iconfont-trash" color={globalColors.black_40} style={stylesIconCancel} />
        </ClickableBox>
      </Box>
    </Box>
    <Divider style={rowStyles.divider} />
  </Box>
)

const stylesCancelBox = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
}

const stylesIconCancel = platformStyles({
  common: {
    padding: globalMargins.tiny,
    paddingRight: 0,
  },
  isMobile: {
    fontSize: 22,
  },
})

const stylesText = platformStyles({
  common: {
    ...globalStyles.fontSemibold,
    maxWidth: '100%',
  },
  isMobile: {
    marginTop: 22,
  },
})

const stylesButton = {
  marginLeft: globalMargins.tiny,
  width: 80,
}

export default Editing
