import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Styles from '@/styles'
import UnfurlImage from '../messages/text/unfurl/unfurl-list/image'
import {getMargins, scaledWidth} from './width'
import type {Props} from '.'

const gridHeight = 100

const GiphySearch = (props: Props) => {
  const [width, setWidth] = React.useState<number | undefined>(undefined)
  const divRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!divRef.current) return
    const cs = getComputedStyle(divRef.current)
    setWidth(divRef.current.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
  }, [])

  let margins: Array<number> = []
  const w = width
  if (w) {
    margins = getMargins(
      w - 2 * Styles.globalMargins.tiny,
      (props.previews || []).reduce<Array<number>>((arr, p) => {
        return arr.concat(p.previewWidth)
      }, [])
    )
  }
  return (
    <Kb.Box style={styles.outerContainer}>
      <Kb.Box2Div
        direction="vertical"
        ref={divRef}
        style={Styles.collapseStyles([
          styles.scrollContainer,
          Styles.platformStyles({isElectron: {overflowY: width ? 'auto' : 'scroll'}}),
        ])}
      >
        <Kb.Box2 direction="horizontal" style={styles.instructionsContainer} fullWidth={true} gap="xtiny">
          <Kb.Text style={styles.instructions} type="BodySmall">
            Tip: hit 'Enter' now to send a random GIF.
          </Kb.Text>
          <Kb.Text
            style={styles.instructions}
            type="BodySmallSecondaryLink"
            onClickURL="https://keybase.io/docs/chat/linkpreviews"
          >
            Learn more about GIFs & encryption
          </Kb.Text>
        </Kb.Box2>
        {width &&
          (props.previews ? (
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
              {props.previews.map((p, index) => {
                const margin = -margins[index]! / 2 - 1
                return p.targetUrl ? (
                  <Kb.Box2 key={String(index)} direction="horizontal" style={styles.imageContainer}>
                    <Kb.Box style={Styles.collapseStyles([{marginLeft: margin, marginRight: margin}])}>
                      <UnfurlImage
                        autoplayVideo={true}
                        height={gridHeight}
                        isVideo={p.previewIsVideo}
                        onClick={() => props.onClick(p)}
                        style={styles.image}
                        url={p.previewUrl}
                        width={scaledWidth(p.previewWidth)}
                      />
                    </Kb.Box>
                  </Kb.Box2>
                ) : null
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
      </Kb.Box2Div>
      <Kb.Icon type="icon-powered-by-giphy-120-26" style={styles.poweredBy} />
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    }) as const
)

export default GiphySearch
