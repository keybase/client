import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import Footer from '../footer/footer'
import View from './view-container'
import {PathItemAction} from '../common'

type Props = {
  onBack: () => void
  path: Types.Path
}

type State = {
  loading: boolean
}

export default class extends React.PureComponent<Props, State> {
  state = {
    loading: false,
  }
  _onLoadingStateChange = (loading: boolean) => this.setState({loading})

  render() {
    return (
      <Kb.Box style={styles.container}>
        <Kb.Box style={styles.header}>
          <Kb.ClickableBox onClick={this.props.onBack} style={styles.closeBox}>
            <Kb.Text type="Body" style={styles.text}>
              Close
            </Kb.Text>
          </Kb.ClickableBox>
        </Kb.Box>
        <Kb.Box style={styles.contentContainer}>
          <View path={this.props.path} onLoadingStateChange={this._onLoadingStateChange} />
        </Kb.Box>
        <Kb.Box style={styles.footer}>
          <PathItemAction
            path={this.props.path}
            clickable={{actionIconWhite: true, type: 'icon'}}
            initView={Types.PathItemActionMenuView.Root}
            mode="screen"
          />
        </Kb.Box>
        <Footer path={this.props.path} onlyShowProofBroken={true} />
        {this.state.loading && <Kb.ProgressIndicator style={styles.loading} white={true} />}
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  closeBox: {
    height: 48,
    paddingLeft: Styles.globalMargins.tiny,
    width: 64,
  },
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      ...Styles.globalStyles.flexGrow,
      backgroundColor: Styles.globalColors.black,
    },
  }),
  contentContainer: {
    ...Styles.globalStyles.flexGrow,
  },
  footer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: 48,
    paddingLeft: Styles.globalMargins.tiny,
  },
  header: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.tiny,
  },
  loading: Styles.platformStyles({
    common: {
      height: 32,
      width: 32,
    },
    isMobile: {
      left: Styles.globalMargins.small,
      position: 'absolute',
      top: 48,
    },
  }),
  text: {
    color: Styles.globalColors.white,
    lineHeight: 48,
  },
})
