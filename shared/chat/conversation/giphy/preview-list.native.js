// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {NativeFlatList} from '../../../common-adapters/native-wrappers.native'
import {getMargin, scaledWidth} from './width'
import UnfurlImage from '../messages/wrapper/unfurl/image'

const gridHeight = 100
const gridWidthMax = 130

class PreviewList extends React.PureComponent<Props<any>, void> {
  _refs = {}
  _renderPreview = arg => {
    const {item} = arg
    const ref = React.createRef()
    this._refs[item.previewUrl] = ref
    const margin = getMargin(item.previewWidth, gridWidthMax)
    console.log('VIDEO: rendering preview: ' + item.previewUrl)
    return (
      <Kb.Box2 key={item.targetUrl} direction="horizontal" style={styles.imageContainer}>
        <Kb.Box style={Styles.collapseStyles([{marginLeft: margin, marginRight: margin}])}>
          <UnfurlImage
            ref={ref}
            autoplayVideo={false}
            height={gridHeight}
            hidePlayButton={true}
            isVideo={item.previewIsVideo}
            onClick={() => this.props.onClick(item.targetUrl)}
            style={styles.image}
            url={item.previewUrl}
            width={scaledWidth(item.previewWidth)}
          />
        </Kb.Box>
      </Kb.Box2>
    )
  }

  _visibilityChanged = ({viewableItems, changed}) => {
    console.log('VIDEO: vis changed')
    changed.forEach(item => {
      const {isViewable, key} = item
      const ref = this._refs[key]
      if (!ref.current) {
        return
      }
      if (isViewable) {
        console.log('VIDEO: playing: ' + key)
        ref.current.playVideo()
      } else {
        console.log('VIDEO: pausing: ' + key)
        ref.current.pauseVideo()
      }
    })
  }

  render() {
    return (
      <NativeFlatList
        renderItem={this._renderPreview}
        data={this.props.previews}
        horizontal={true}
        keyExtractor={item => item.previewUrl}
        onViewableItemsChanged={this._visibilityChanged}
      />
    )
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
