import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as Kb from '../../../../../common-adapters/mobile.native'
import {useRedux} from './use-redux'

const Image2Impl = () => {
  const {previewURL, height, width} = useRedux()
  const fiSrc = React.useMemo(() => ({uri: previewURL}), [previewURL])
  return (
    <Kb.NativeFastImage
      source={fiSrc}
      style={Styles.collapseStyles([styles.image, {height, width}])}
      resizeMode="cover"
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  image: {
    backgroundColor: Styles.isIOS ? Styles.globalColors.black_05_on_white : undefined,
    maxHeight: 320,
    maxWidth: '100%',
  },
}))

export default Image2Impl
