// @flow
import React from 'react'
import {Box, Button, HeaderHoc, Input, PopupDialog, Text, ScrollView} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

type Props = {

}

const DeleteHistoryWarning = ({errorText, name, onDeleteHistory}: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      ...stylePadding,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: globalColors.white,
    }}
  >
    <Text type="Body">Are you sure?</Text>
    <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xlarge}}>
      <Button
        type="Primary"
        style={{marginLeft: globalMargins.tiny}}
        onClick={onDeleteHistory}
        label="Yes"
      />
    </Box>
  </Box>
)

const styleContainer = {
  ...globalStyles.flexBoxCenter,
  ...(isMobile ? {} : {cursor: 'default'}),
  minHeight: 40,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  borderTopLeftRadius: isMobile ? 0 : 4,
  borderTopRightRadius: isMobile ? 0 : 4,
}

const stylePadding = isMobile
  ? {
      paddingTop: globalMargins.xlarge,
    }
  : {
      marginBottom: 80,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 90,
    }

export default (isMobile ? HeaderHoc(DeleteHistoryWarning) : DeleteHistoryWarning)
