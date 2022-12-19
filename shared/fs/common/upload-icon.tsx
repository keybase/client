import * as Types from '../../constants/types/fs'
import Icon, {type IconStyle} from '../../common-adapters/icon'

type Props = {
  style?: IconStyle
  uploadIcon: Types.UploadIcon
}

const UploadIcon = (props: Props) => {
  switch (props.uploadIcon) {
    case Types.UploadIcon.AwaitingToUpload:
      return <Icon type="icon-addon-file-uploading-offline" style={props.style} />
    case Types.UploadIcon.Uploading:
      return <Icon type="icon-addon-file-uploading" style={props.style} />
    case Types.UploadIcon.UploadingStuck:
      return <Icon type="icon-addon-file-uploading-error" style={props.style} />
  }
}

export default UploadIcon
