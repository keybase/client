// @flow
import * as React from 'react'
import {NameWithIcon} from '../../../../common-adapters'
import {showImagePicker, type Response} from 'react-native-image-picker'
import type {Props} from '.'

const NameWithIconWrapper = (props: Props) => {
  const _onEditIcon = () =>
    props.canEditDescription
      ? showImagePicker({mediaType: 'photo'}, (response: Response) => {
          if (response.didCancel) {
            return
          }
          if (response.error) {
            props.onFilePickerError(new Error(response.error))
            return
          }
          props.onEditIcon(response)
        })
      : undefined

  return (
    <NameWithIcon
      editableIcon={props.canEditDescription}
      onEditIcon={_onEditIcon}
      size="large"
      teamname={props.teamname}
      title={props.teamname}
      metaOne={props.metaOne}
      metaTwo={props.metaTwo}
    />
  )
}

export default NameWithIconWrapper
