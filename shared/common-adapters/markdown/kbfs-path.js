// @flow
import React from 'react'
import Text from '../text'
import * as Types from '../../constants/types/fs'
import features from '../../util/feature-flags'

export type Props = {
  path: Types.Path,
  onClick: () => void,
  allowFontScaling?: ?boolean,
}

export default (features.kbfsChatIntegration
  ? (props: Props) => (
      <Text type="BodyPrimaryLink" onClick={props.onClick} allowFontScaling={!!props.allowFontScaling}>
        {Types.pathToString(props.path)}
      </Text>
    )
  : (props: Props) => (
      <Text type="Body" allowFontScaling={!!props.allowFontScaling}>
        {Types.pathToString(props.path)}
      </Text>
    ))
