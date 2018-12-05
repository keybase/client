// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import UnfurlImage from '../messages/wrapper/unfurl/image'

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

const gridWidth = 100

class GiphySearch extends React.Component<Props> {
  _scaledWidth(width: number) {
    return width * 0.5
  }
  _getMargin(width: number) {
    return -((this._scaledWidth(width) - gridWidth) / 2)
  }
  render() {
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
        {(this.props.previews || []).map(p => {
          const margin = this._getMargin(p.previewWidth)
          return (
            <Kb.Box2 key={p.targetUrl} direction="horizontal" style={styles.imageContainer}>
              <Kb.ClickableBox onClick={() => this.props.onClick(p.targetUrl)}>
                <UnfurlImage
                  url={p.previewUrl}
                  height={gridWidth}
                  width={this._scaledWidth(p.previewWidth)}
                  isVideo={p.previewIsVideo}
                  style={Styles.collapseStyles([{marginLeft: margin, marginRight: margin}, styles.image])}
                />
              </Kb.ClickableBox>
            </Kb.Box2>
          )
        })}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    minHeight: 200,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  imageContainer: {
    alignSelf: 'flex-start',
    borderStyle: 'solid',
    borderWidth: 2,
    borderColor: Styles.globalColors.black,
    overflow: 'hidden',
    margin: -1,
  },
  image: {
    borderRadius: 0,
  },
})

export default GiphySearch
