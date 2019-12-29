import * as React from 'react'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

const LoadMoreSmalls = () => {
  const dispatch = Container.useDispatch()
  const onClick = () => {
    dispatch(Chat2Gen.createLoadMoreSmalls())
  }
  return (
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.Button fullWidth={true} mode="Secondary" label="Load more" onClick={onClick} />
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.blueGreyLight,
      flexShrink: 0,
      padding: Styles.globalMargins.small,
      width: '100%',
    },
    isMobile: {
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.fastBlank,
      flexShrink: 0,
      width: '100%',
    },
  }),
}))

export default LoadMoreSmalls
