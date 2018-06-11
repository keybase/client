// @flow
import * as React from 'react'
import {showImagePicker} from 'react-native-image-picker'
import {StandardScreen, Box, Button, ButtonBar} from '../../common-adapters'
import {isIOS} from '../../constants/platform'
import {globalStyles, globalMargins} from '../../styles'
import type {Props} from '.'

class EditAvatar extends React.Component<Props> {
  _openFilePicker = () => {
    showImagePicker({mediaType: 'photo'}, response => {
      if (response.didCancel) {
        return
      }
      if (response.error) {
        console.error(response.error)
        throw new Error(response.error)
      }
      const filename = isIOS ? response.uri.replace('file://', '') : response.path
      this._paintImage(filename)
    })
  }

  _paintImage = (path: string) => {}

  render() {
    return (
      <StandardScreen style={{...globalStyles.flexBoxColumn, flex: 1}} onBack={this.props.onClose}>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.small}}>
          <ButtonBar>
            <Button type="Secondary" fullWidth={true} onClick={this.props.onClose} label="Cancel" />
          </ButtonBar>
        </Box>
      </StandardScreen>
    )
  }
}

export default EditAvatar
