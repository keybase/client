// @flow
import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import DesktopStyle from '../common-adapters/desktop-style'
import {serviceIdToIconFont, serviceIdToAccentColor} from './shared'
import type {ServiceIdWithContact} from '../constants/types/team-building'

export type Props = {
  username: string,
  prettyName: string,
  service: ServiceIdWithContact,
  onRemove: () => void,
}

const KeybaseUserBubble = (props: Props) => (
  <Kb.Box2 className="user" direction="horizontal" style={styles.bubble}>
    <Kb.ConnectedNameWithIcon
      colorFollowing={true}
      horizontal={false}
      icon={props.service !== 'keybase' ? serviceIdToIconFont(props.service) : undefined}
      size="smaller"
      username={props.username}
    />
  </Kb.Box2>
)

const GeneralServiceBubble = (props: Props) => (
  <Kb.Icon
    style={styles.generalService}
    fontSize={bubbleSize}
    type={serviceIdToIconFont(props.service)}
    colorOverride={serviceIdToAccentColor(props.service)}
  />
)

const DesktopBubble = (props: Props) => {
  const realCSS = `
    .hoverContainer { position: relative; }
    .hoverContainer .hoverComponent { visibility: hidden; position: absolute; top: 0; right: 0; }
    .hoverContainer:hover .hoverComponent { visibility: visible; }
    `
  return (
    <Kb.Box2 direction="vertical" className="hoverContainer">
      <DesktopStyle style={realCSS} />
      <KeybaseUserBubble {...props} />
      <Kb.Box2 direction="horizontal" className="hoverComponent">
        <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const RemoveBubble = ({onRemove, prettyName}: {onRemove: () => void, prettyName: string}) => (
  <Kb.WithTooltip text={prettyName} position={'top center'} containerStyle={styles.remove} className="remove">
    <Kb.ClickableBox onClick={() => onRemove()} style={styles.removeBubbleTextAlignRight}>
      <Kb.Icon
        type={'iconfont-close'}
        color={Styles.globalColors.black_50_on_white}
        fontSize={16}
        style={Kb.iconCastPlatformStyles(styles.removeIcon)}
      />
    </Kb.ClickableBox>
  </Kb.WithTooltip>
)

type SwapOnClickProps = Kb.PropsWithTimer<{
  children: React.Node,
  clickedLayerComponent: React.AbstractComponent<{||}>,
  clickedLayerTimeout: number,
  containerStyle?: Styles.StylesCrossPlatform,
}>

class _SwapOnClick extends React.PureComponent<SwapOnClickProps, {showClickedLayer: boolean}> {
  state = {showClickedLayer: false}
  _onClick = () => {
    if (!this.state.showClickedLayer) {
      this.setState({showClickedLayer: true})
      if (this.props.clickedLayerTimeout) {
        this.props.setTimeout(() => this.setState({showClickedLayer: false}), this.props.clickedLayerTimeout)
      }
    }
  }

  render() {
    const ClickedLayerComponent = this.props.clickedLayerComponent
    return (
      <Kb.ClickableBox onClick={this._onClick} style={this.props.containerStyle}>
        {this.state.showClickedLayer ? <ClickedLayerComponent /> : this.props.children}
      </Kb.ClickableBox>
    )
  }
}
const SwapOnClick = Kb.HOCTimers(_SwapOnClick)

function SwapOnClickHoc<A>(
  Component: React.AbstractComponent<{}, A>,
  OtherComponent: React.AbstractComponent<{}, A>
): React.AbstractComponent<{containerStyle?: Styles.StylesCrossPlatform}> {
  return ({containerStyle}) => (
    <SwapOnClick
      containerStyle={containerStyle}
      clickedLayerTimeout={5e3}
      clickedLayerComponent={OtherComponent}
    >
      <Component />
    </SwapOnClick>
  )
}

const UserBubble = (props: Props) => {
  const NormalComponent = () =>
    props.service === 'keybase' ? <KeybaseUserBubble {...props} /> : <GeneralServiceBubble {...props} />
  const AlternateComponent = () => <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove} />
  const Component = SwapOnClickHoc(NormalComponent, AlternateComponent)

  return Styles.isMobile ? <Component containerStyle={styles.container} /> : <DesktopBubble {...props} />
}

const bubbleSize = 32
const removeSize = 16

const styles = Styles.styleSheetCreate({
  bubble: Styles.platformStyles({
    common: {},
    isElectron: {
      flexShrink: 1,
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
    },
  }),
  container: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: Styles.globalMargins.tiny,
      marginTop: Styles.globalMargins.xtiny,
    },
  }),
  generalService: Styles.platformStyles({
    isElectron: {
      lineHeight: '35px',
    },
  }),

  remove: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: 100,
      height: removeSize,
      width: removeSize,
    },
    isElectron: {
      cursor: 'pointer',
    },
  }),

  removeBubbleTextAlignRight: Styles.platformStyles({
    isElectron: {
      textAlign: 'center',
    },
    isMobile: {
      alignItems: 'center',
      flex: 1,
    },
  }),

  removeIcon: Styles.platformStyles({
    isElectron: {
      lineHeight: '16px',
    },
    isMobile: {
      lineHeight: removeSize,
    },
  }),
})

export default UserBubble
