// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import UnfurlImage from '../messages/wrapper/unfurl/image'
import PreviewList from './preview-list'
import {getMargin, scaledWidth} from './width'

export type GifPreview = {
  targetUrl: string,
  previewUrl: string,
  previewHeight: number,
  previewWidth: number,
  previewIsVideo: boolean,
}

export type Props = {
  previews: Array<GifPreview>,
  onClick: string => void,
}

const gridHeight = 100
const gridWidthMax = 130

class GiphySearch extends React.Component<Props> {
  _scaledWidth = (width: number) => {
    return width * 0.5
  }
  _getMargin = (width: number) => {
    const m = -((scaledWidth(width) - gridWidthMax) / 2)
    return m > 0 ? 0 : m
  }

  render() {
    return Styles.isMobile ? (
      <PreviewList previews={this.props.previews} onClick={this.props.onClick} />
    ) : (
      <Kb.ScrollView style={styles.scrollContainer} horizontal={Styles.isMobile}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
          <PreviewList previews={this.props.previews} onClick={this.props.onClick} />
        </Kb.Box2>
      </Kb.ScrollView>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      flexWrap: 'wrap',
      justifyContent: 'center',
      minHeight: 200,
    },
  }),
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
  scrollContainer: Styles.platformStyles({
    isElectron: {
      maxHeight: 300,
    },
    isMobile: {
      maxHeight: 100,
    },
  }),
})

export default GiphySearch
