import * as React from 'react'
import {NameWithIcon} from '../../../../common-adapters'
// @ts-ignore not typed yet
import {showImagePicker, Response} from 'react-native-image-picker'
import {Props} from '.'

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
      size="big"
      teamname={props.teamname}
      title={props.title}
      metaOne={props.metaOne}
      metaTwo={props.metaTwo}
    />
  )
}

export default NameWithIconWrapper
