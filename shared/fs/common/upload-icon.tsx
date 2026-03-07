import type * as Styles from '@/styles'
import * as T from '@/constants/types'
import IconAuto from '@/common-adapters/icon-auto'

type Props = {
  style?: Styles.StylesCrossPlatform
  uploadIcon: T.FS.UploadIcon
}

const UploadIcon = (props: Props) => {
  switch (props.uploadIcon) {
    case T.FS.UploadIcon.AwaitingToUpload:
      return <IconAuto type="icon-addon-file-uploading-offline" style={props.style} />
    case T.FS.UploadIcon.Uploading:
      return <IconAuto type="icon-addon-file-uploading" style={props.style} />
    case T.FS.UploadIcon.UploadingStuck:
      return <IconAuto type="icon-addon-file-uploading-error" style={props.style} />
  }
}

export default UploadIcon
