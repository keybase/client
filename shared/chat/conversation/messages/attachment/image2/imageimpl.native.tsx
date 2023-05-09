import * as React from 'react'
import * as Styles from '../../../../../styles'
import * as Kb from '../../../../../common-adapters'
import {useRedux} from './use-redux'

const Image2Impl = () => {
  const {previewURL, height, width} = useRedux()
  return <Kb.Image2 src={previewURL} style={Styles.collapseStyles([styles.image, {height, width}])} />
}

const styles = Styles.styleSheetCreate(() => ({
  image: {
    backgroundColor: Styles.isIOS ? Styles.globalColors.black_05_on_white : undefined,
    maxHeight: 320,
    maxWidth: '100%',
  },
}))

export default Image2Impl
