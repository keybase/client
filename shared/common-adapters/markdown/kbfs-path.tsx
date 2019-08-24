import React from 'react'
import Text, {StylesTextCrossPlatform} from '../text'
import * as Types from '../../constants/types/fs'

export type Props = {
  path: Types.Path
  onClick: () => void
  allowFontScaling?: boolean | null
  style?: StylesTextCrossPlatform
}

export default (props: Props) => (
  <Text
    type="BodyPrimaryLink"
    onClick={props.onClick}
    allowFontScaling={!!props.allowFontScaling}
    style={props.style}
  >
    {Types.pathToString(props.path)}
  </Text>
)
