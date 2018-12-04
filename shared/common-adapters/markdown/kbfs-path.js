// @flow
import React from 'react'
import Text from '../text'
import * as Types from '../../constants/types/fs'

export type Props = {
  path: Types.Path,
  onClick: () => void,
  allowFontScaling?: ?boolean,
}

export default (props: Props) => {
  return (
    <Text type="BodyPrimaryLink" onClick={props.onClick} allowFontScaling={!!props.allowFontScaling}>
      {Types.pathToString(props.path)}
    </Text>
  )
}
