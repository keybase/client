import React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type Props = {
  text: string
  seen: boolean
}

const NewFeature = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal">
      {props.seen && (
        <Kb.Badge height={8} badgeStyle={styles.badgeStyle} containerStyle={styles.badgeContainerStyle} />
      )}
      <Kb.Box2 direction="vertical" style={styles.contentContainer} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  badgeContainerStyle: {
    color: Styles.globalColors.transparent,
  },
  badgeStyle: {
    backgroundColor: Styles.globalColors.blue,
  },
  container: {},
  contentContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
}))

export default NewFeature
