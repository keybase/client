import * as React from 'react'
import * as FsTypes from '../constants/types/fs'
import * as Constants from '../constants/fs'
import * as Container from '../util/container'
import Text from './text'

type Props = {
  deeplinkPath: string
  platformAfterMountPath: string
  rawPath: string
  standardPath: FsTypes.Path
}

const KbfsPath = ({rawPath, standardPath}: Props) => {
  const dispatch = Container.useDispatch()
  const onClick = React.useCallback(() => dispatch(Constants.makeActionForOpenPathInFilesTab(standardPath)), [
    dispatch,
    standardPath,
  ])
  return (
    <Text type="BodyPrimaryLink" onClick={onClick} allowFontScaling={true}>
      {rawPath}
    </Text>
  )
}

export default KbfsPath
