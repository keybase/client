// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {resolveImageAsURL} from '../../../desktop/app/resolve-root.desktop'
import UnfurlImage from '../messages/wrapper/unfurl/image'
import {getMargin, scaledWidth} from './width'
import type {Props} from './index.types'

const gridHeight = 100
const gridWidthMax = 130
const poweredByImg = 'powered-by-giphy.png'

const GiphySearch = (props: Props) => {
  return (
    <Kb.ScrollView style={styles.scrollContainer}>
      <Kb.Box2 direction="horizontal" style={styles.poweredByContainer} fullWidth={true}>
        <Kb.Image src={resolveImageAsURL('', poweredByImg)} style={styles.poweredBy} />
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.container}>
        {(props.previews || []).map(p => {
          const margin = getMargin(p.previewWidth, gridWidthMax)
          return (
            <Kb.Box2 key={p.targetUrl} direction="horizontal" style={styles.imageContainer}>
              <Kb.Box style={Styles.collapseStyles([{marginLeft: margin, marginRight: margin}])}>
                <UnfurlImage
                  autoplayVideo={true}
                  height={gridHeight}
                  isVideo={p.previewIsVideo}
                  onClick={() => props.onClick(p.targetUrl)}
                  style={styles.image}
                  url={p.previewUrl}
                  width={scaledWidth(p.previewWidth)}
                />
              </Kb.Box>
            </Kb.Box2>
          )
        })}
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Styles.styleSheetCreate({
  container: {
    flexWrap: 'wrap',
    justifyContent: 'center',
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
  poweredBy: {
    height: 25,
    width: 'auto',
  },
  poweredByContainer: {
    justifyContent: 'center',
  },
  scrollContainer: {
    maxHeight: 300,
  },
})

export default GiphySearch
