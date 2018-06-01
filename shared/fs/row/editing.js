// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {globalStyles, globalMargins} from '../../styles'
import rowStyles from './styles'
import {Input, Box, Button, Text, Divider} from '../../common-adapters'
import PathItemIcon from '../common/path-item-icon'

type EditingProps = {
  name: string,
  status: Types.PathItemEditingStatusType,
  itemStyles: Types.ItemStyles,
  isCreate: boolean,
  onSubmit: () => void,
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
          hintText={props.name}
          inputStyle={stylesText}
          onEnterKeyDown={props.onSubmit}
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
        <Button
          key="cancel"
          style={stylesButton}
          type="Secondary"
          small={true}
          label="Cancel"
          onClick={props.onCancel}
        />
      </Box>
    </Box>
    <Divider style={rowStyles.divider} />
  </Box>
)

const stylesText = {
  ...globalStyles.fontSemibold,
  maxWidth: '100%',
}

const stylesButton = {
  marginLeft: globalMargins.tiny,
  width: 80,
}

export default Editing
