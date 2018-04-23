// @flow
import * as Types from '../../constants/types/fs'

export type FilePreviewProps = {
  fileUIEnabled: boolean,
  pathItem: Types.PathItemMetadata,
  itemStyles: Types.ItemStyles,
  onAction: (targetRect?: ?ClientRect) => void,
  onBack: () => void,
  onDownload: () => void,
  onShowInFileUI: () => void,
  onShare: () => void,
  onSave: () => void,
}
