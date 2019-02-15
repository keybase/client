// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import UnfurlImage from '../messages/wrapper/unfurl/image'
import {getMargin, scaledWidth} from './width'
import type {Props} from './index.types'

const gridHeight = 100
const gridWidthMax = 150

type State = {
  width: ?number,
}

class GiphySearch extends React.Component<Props, State> {
  _boxRef = React.createRef()
  state = {width: null}

  componentDidMount() {
    if (this.container) {
      this.setState({width: this.container.clientWidth})
    }
  }

  render() {
    return (
      <Kb.Box style={styles.outerContainer}>
        <div ref={el => (this.container = el)} style={styles.scrollContainer}>
          <Kb.Box2 direction="horizontal" style={styles.instructionsContainer} fullWidth={true} gap="tiny">
            <Kb.Text style={styles.instructions} type="BodySmall">
              Hit enter for a random GIF, or click a preview to send
            </Kb.Text>
          </Kb.Box2>
          {this.state.width && (
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
              {(this.props.previews || []).map(p => {
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
              })}
            </Kb.Box2>
          )}
        </div>
        <Kb.Icon type="icon-powered-by-giphy-120-26" style={styles.poweredBy} />
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    minHeight: 200,
  },
  image: {
    borderRadius: 0,
  },
  imageContainer: {
    alignSelf: 'flex-start',
    borderColor: Styles.globalColors.black,
    borderStyle: 'solid',
    borderWidth: Styles.globalMargins.xxtiny,
    margin: -1,
    overflow: 'hidden',
  },
  instructions: {
    alignSelf: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
  instructionsContainer: {
    justifyContent: 'center',
  },
  outerContainer: {
    marginLeft: 15,
    marginRight: 15,
    position: 'relative',
  },
  poweredBy: {
    bottom: 0,
    position: 'absolute',
    right: 0,
  },
  scrollContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      borderRadius: Styles.borderRadius,
      marginLeft: 15,
      marginRight: 15,
      maxHeight: 300,
      minHeight: 200,
      overflow: 'auto',
    },
  }),
})

export default GiphySearch
