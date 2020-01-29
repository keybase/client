import * as React from 'react'
import * as Types from '../../constants/types/fs'
import Icon, {IconStyle, IconType} from '../../common-adapters/icon'

const Kb = {IconType}

type Props = {
  style?: IconStyle
  uploadIcon: Types.UploadIcon
}

const UploadIcon = (props: Props) => {
  switch (props.uploadIcon) {
    case Types.UploadIcon.AwaitingToUpload:
      return <Icon type={Kb.IconType.icon_addon_file_uploading_offline} style={props.style} />
    case Types.UploadIcon.Uploading:
      return <Icon type={Kb.IconType.icon_addon_file_uploading} style={props.style} />
    case Types.UploadIcon.UploadingStuck:
      return <Icon type={Kb.IconType.icon_addon_file_uploading_error} style={props.style} />
  }
}

export default UploadIcon
