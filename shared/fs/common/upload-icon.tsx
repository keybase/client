import * as T from '../../constants/types'
import Icon, {type IconStyle} from '../../common-adapters/icon'

type Props = {
  style?: IconStyle
  uploadIcon: T.FS.UploadIcon
}

const UploadIcon = (props: Props) => {
  switch (props.uploadIcon) {
    case T.FS.UploadIcon.AwaitingToUpload:
      return <Icon type="icon-addon-file-uploading-offline" style={props.style} />
    case T.FS.UploadIcon.Uploading:
      return <Icon type="icon-addon-file-uploading" style={props.style} />
    case T.FS.UploadIcon.UploadingStuck:
      return <Icon type="icon-addon-file-uploading-error" style={props.style} />
  }
}

export default UploadIcon
