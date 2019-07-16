import * as React from 'react'
import {NameWithIcon} from '../../../../common-adapters'
import * as ImagePicker from 'expo-image-picker'
import {Props} from '.'
import {parseUri} from '../../../../util/expo-image-picker'

const NameWithIconWrapper = (props: Props) => {
  const _onEditIcon = () =>
    props.canEditDescription
      ? ImagePicker.launchImageLibraryAsync({mediaTypes: ImagePicker.MediaTypeOptions.All}).then(result => {
          if (result.cancelled === false) {
            props.onEditIcon(parseUri(result))
          }
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
