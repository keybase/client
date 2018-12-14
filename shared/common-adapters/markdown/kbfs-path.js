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

// Checking the feature flag outside the component to avoid doing that during
// the rendering. Probably not a huge deal though as this doesn't happen much
// yet.
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
