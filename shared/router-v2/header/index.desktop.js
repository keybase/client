// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {LeftAction} from '../../common-adapters/header-hoc'

// Fix this as we figure out what this needs to be
type Props = any

class Header extends React.PureComponent<Props> {
  render() {
    // TODO add more here as we use more options on the mobile side maybe
    const opt = this.props.options
    if (opt.headerMode === 'none') {
      return null
    }

    // let leftAction = null
    // if (typeof opt.headerBackTitle === 'string') {
    // leftAction = (
    // <Kb.Text type="BodyPrimaryLink" onClick={opt.onPop}>
    // {opt.headerBackTitle}
    // </Kb.Text>
    // )
    // } else if (typeof opt.headerBackTitle === 'function') {
    // const CustomBackTitle = opt.headerBackTitle
    // leftAction = <CustomBackTitle />
    // } else {
    // leftAction = (
    // )
    // }

    let title = null
    if (typeof opt.headerTitle === 'string') {
      title = <Kb.Text type="BodySemibold">{opt.headerTitle}</Kb.Text>
    } else if (typeof opt.headerTitle === 'function') {
      const CustomTitle = opt.headerTitle
      title = <CustomTitle>{opt.title}</CustomTitle>
    }

    let style = null
    if (opt.headerTransparent) {
      style = {position: 'absolute', zIndex: 9999}
    }

    return (
      <Kb.Box2
        noShrink={true}
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([styles.headerContainer, style])}
        gap="xtiny"
        gapEnd={true}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.headerBack}>
          <LeftAction
            badgeNumber={0}
            leftAction="back"
            hideBackLabel={true}
            onLeftAction={this.props.onPop}
            disabled={!this.props.allowBack}
          />
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          {title}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  headerBack: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      minHeight: 36,
    },
  }),
  headerContainer: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      ...Styles.desktopStyles.windowDragging,
    },
  }),
})

export default Header
