import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import Footer from '../footer/footer'
import View from './view-container'

type NormalPreviewProps = {
  path: Types.Path
}

type State = {
  loading: boolean
}

export default class NormalPreview extends React.PureComponent<NormalPreviewProps, State> {
  state = {
    loading: false,
  }

  _onLoadingStateChange = (loading: boolean) => this.setState({loading})

  render() {
    return (
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
        <Kbfs.Errs />
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.greyContainer}>
          <View path={this.props.path} onLoadingStateChange={this._onLoadingStateChange} />
          {this.state.loading && <Kb.ProgressIndicator style={styles.loading} />}
        </Kb.Box2>
        <Footer path={this.props.path} />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  contentContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      ...Styles.globalStyles.flexGrow,
      height: '100%',
      width: '100%',
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
  }),
  greyContainer: {
    backgroundColor: Styles.globalColors.blueLighter3,
    flex: 1,
    flexShrink: 1,
  },
  loading: Styles.platformStyles({
    common: {
      height: 32,
      width: 32,
    },
    isElectron: {
      left: 40,
      position: 'absolute',
      top: 86,
    },
    isMobile: {
      left: 0,
      position: 'absolute',
      top: 0,
    },
  }),
})
