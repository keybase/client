// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import type {Props} from './preview-list.types'
import {getMargin, scaledWidth} from './width'
import UnfurlImage from '../messages/wrapper/unfurl/image'

const gridHeight = 100
const gridWidthMax = 130

class PreviewList extends React.PureComponent<Props<any>, void> {
  render() {
    return (this.props.previews || []).map(p => {
      const margin = getMargin(p.previewWidth, gridWidthMax)
      return (
        <Kb.Box2 key={p.targetUrl} direction="horizontal" style={styles.imageContainer}>
          <Kb.Box style={Styles.collapseStyles([{marginLeft: margin, marginRight: margin}])}>
            <UnfurlImage
              autoplayVideo={true}
              height={gridHeight}
              isVideo={p.previewIsVideo}
              onClick={() => this.props.onClick(p.targetUrl)}
              style={styles.image}
              url={p.previewUrl}
              width={scaledWidth(p.previewWidth)}
            />
          </Kb.Box>
        </Kb.Box2>
      )
    })
  }
}

const styles = Styles.styleSheetCreate({
  image: {
    borderRadius: 0,
  },
  imageContainer: {
    alignSelf: 'flex-start',
    borderColor: Styles.globalColors.black,
    borderStyle: 'solid',
    borderWidth: 2,
    margin: -1,
    overflow: 'hidden',
  },
})

export default PreviewList
