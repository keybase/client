/* eslint-disable react/no-did-mount-set-state */
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import UnfurlImage from '../messages/wrapper/unfurl/image'
import {getMargins, scaledWidth} from './width'
import {Props} from './index.types'

const gridHeight = 100

type State = {
  width: number | null
}

class GiphySearch extends React.Component<Props, State> {
  container: HTMLDivElement | null = null
  state = {width: null}

  componentDidMount() {
    const c = this.container
    if (c) {
      this.setState({width: c.clientWidth})
    }
  }

  render() {
    let margins: Array<number> = []
    const w = this.state.width
    if (w) {
      margins = getMargins(
        w - 2 * Styles.globalMargins.tiny,
        (this.props.previews || []).reduce<Array<number>>((arr, p) => {
          return arr.concat(p.previewWidth)
        }, [])
      )
    }
    return (
      <Kb.Box style={styles.outerContainer}>
        <Kb.Box
          forwardedRef={el => (this.container = el)}
          style={Styles.collapseStyles([
            styles.scrollContainer,
            {overflowY: this.state.width ? 'auto' : 'scroll'},
          ])}
        >
          <Kb.Box2 direction="horizontal" style={styles.instructionsContainer} fullWidth={true} gap="tiny">
            <Kb.Text style={styles.instructions} type="BodySmall">
              Hit enter for a random GIF, or click a preview to send
            </Kb.Text>
            <Kb.Text
              style={styles.instructions}
              type="BodySmallSecondaryLink"
              onClickURL={'https://keybase.io/docs/chat/linkpreviews'}
            >
              (More Info)
            </Kb.Text>
          </Kb.Box2>
          {this.state.width &&
            (this.props.previews ? (
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
                {(this.props.previews || []).map((p, index) => {
                  const margin = -margins[index] / 2 - 1
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
            ) : (
              <Kb.Box2
                direction="vertical"
                style={styles.loadingContainer}
                centerChildren={true}
                fullWidth={true}
                fullHeight={true}
              >
                <Kb.ProgressIndicator />
              </Kb.Box2>
            ))}
        </Kb.Box>
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
  instructions: Styles.platformStyles({
    common: {
      alignSelf: 'center',
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      lineHeight: 17,
    },
  }),
  instructionsContainer: {
    justifyContent: 'center',
  },
  loadingContainer: {
    minHeight: 200,
  },
  outerContainer: {
    marginBottom: Styles.globalMargins.xtiny,
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.small,
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
      border: `1px solid ${Styles.globalColors.black_20}`,
      borderRadius: Styles.borderRadius,
      maxHeight: 300,
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
})

export default GiphySearch
