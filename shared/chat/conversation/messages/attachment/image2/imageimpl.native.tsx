import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useState} from './use-state'

const Image2Impl = () => {
  const {previewURL, height, width} = useState()
  return <Kb.Image2 src={previewURL} style={Kb.Styles.collapseStyles([styles.image, {height, width}])} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  image: {
    backgroundColor: Kb.Styles.isIOS ? Kb.Styles.globalColors.black_05_on_white : undefined,
    maxHeight: 320,
    maxWidth: '100%',
  },
}))

export default Image2Impl
