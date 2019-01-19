// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import UnfurlImage from '../messages/wrapper/unfurl/image'
import {getMargin, scaledWidth} from './width'
import type {Props} from './index.types'

const gridHeight = 100
const gridWidthMax = 130

const GiphySearch = (props: Props) => {
  return (
    <Kb.ScrollView style={styles.scrollContainer} horizontal={Styles.isMobile}>
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
