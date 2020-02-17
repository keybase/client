import * as React from 'react'
import {NameWithIcon} from '../../../../common-adapters'
import {Props} from '.'
import {launchImageLibraryAsync} from '../../../../util/expo-image-picker'

const NameWithIconWrapper = (props: Props) => {
  const _onEditIcon = () =>
    props.canEditDescription
      ? launchImageLibraryAsync('mixed')
          .then(result => {
            if (result.cancelled === false) {
              props.onEditIcon(result)
            }
          })
          .catch(error => props.onFilePickerError(new Error(error)))
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
