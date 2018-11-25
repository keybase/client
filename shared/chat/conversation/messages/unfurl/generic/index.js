// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters/index'
import * as Styles from '../../../../../styles'
import {formatTimeForMessages} from '../../../../../util/timestamp'

export type Props = {
  title: string,
  url: string,
  siteName: string,
  description?: string,
  publishTime?: number,
  imageURL?: string,
  faviconURL?: string,
  onClose?: () => void,
  showImageOnSide: boolean,
}

type State = {
  showClose: boolean,
}

class UnfurlGeneric extends React.Component<Props, State> {
  state = {showClose: false}
  _onMouseOver = () => {
    this.setState({showClose: true})
  }
  _onMouseLeave = () => {
    this.setState({showClose: false})
  }
  render() {
    return (
      <Kb.Box2
        style={styles.container}
        onMouseOver={this._onMouseOver}
        onMouseLeave={this._onMouseLeave}
        gap="tiny"
        direction="horizontal"
      >
        {!Styles.isMobile && <Kb.Box2 direction="horizontal" style={styles.quoteContainer} />}
        <Kb.Box2 style={styles.innerContainer} gap="xxtiny" direction="vertical">
          <Kb.Box2 style={styles.siteNameContainer} gap="tiny" fullWidth={true} direction="horizontal">
            <Kb.Box2 direction="horizontal" gap="tiny">
              {!!this.props.faviconURL && <Kb.Image src={this.props.faviconURL} style={styles.favicon} />}
              <Kb.Text type="BodySmall">
                {this.props.siteName}
                {!!this.props.publishTime && (
                  <Kb.Text type="BodySmall">
                    {' '}
                    • Published {formatTimeForMessages(this.props.publishTime)}
                  </Kb.Text>
                )}
              </Kb.Text>
            </Kb.Box2>
            {!!this.props.onClose &&
              this.state.showClose &&
              !Styles.isMobile && (
                <Kb.Icon
                  type="iconfont-close"
                  onClick={this.props.onClose}
                  style={styles.closeBox}
                  fontSize={12}
                />
              )}
          </Kb.Box2>
          <Kb.Text type="BodyPrimaryLink" style={styles.url} onClickURL={this.props.url}>
            {this.props.title}
          </Kb.Text>
          {!!this.props.description && <Kb.Text type="Body">{this.props.description}</Kb.Text>}
          {!!this.props.imageURL &&
            !Styles.isMobile &&
            !this.props.showImageOnSide && <Kb.Image src={this.props.imageURL} style={styles.bottomImage} />}
        </Kb.Box2>
        {!!this.props.imageURL &&
          !Styles.isMobile &&
          this.props.showImageOnSide && <Kb.Image src={this.props.imageURL} style={styles.sideImage} />}
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
    },
    isElectron: {
      maxWidth: 500,
    },
    isMobile: {
      paddingRight: 66,
    },
  }),
  quoteContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.lightGrey,
      paddingLeft: Styles.globalMargins.xtiny,
      alignSelf: 'stretch',
    },
  }),
  innerContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      paddingLeft: Styles.globalMargins.tiny,
      minWidth: 150,
    },
    isMobile: {
      borderWidth: 1,
      borderRadius: Styles.borderRadius,
      borderColor: Styles.globalColors.lightGrey,
      padding: Styles.globalMargins.xtiny,
    },
  }),
  siteNameContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      justifyContent: 'space-between',
    },
  }),
  closeBox: Styles.platformStyles({
    isElectron: {
      marginLeft: 'auto',
      alignSelf: 'flex-start',
    },
  }),
  bottomImage: Styles.platformStyles({
    common: {
      marginTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      maxWidth: 320,
      maxHeight: 180,
    },
  }),
  sideImage: Styles.platformStyles({
    isElectron: {
      maxWidth: 80,
      maxHeight: 80,
    },
  }),
  url: {
    ...Styles.globalStyles.fontSemibold,
  },
  favicon: Styles.platformStyles({
    common: {
      width: 16,
      height: 16,
    },
  }),
})

export default UnfurlGeneric
