// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import Footer from '../footer/footer'
import Header from './header-container'
import View from './view-container'

type NormalPreviewProps = {
  path: Types.Path,
  routePath: I.List<string>,
}

type State = {
  loading: boolean,
}

export default class NormalPreview extends React.PureComponent<NormalPreviewProps, State> {
  state = {
    loading: false,
  }

  _onLoadingStateChange = (loading: boolean) => this.setState({loading})

  render() {
    return (
      <Kb.Box style={styles.outerContainer}>
        <Header path={this.props.path} routePath={this.props.routePath} />
        <Kbfs.Errs />
        <Kb.Divider />
        <Kb.Box style={styles.greyContainer}>
          <Kb.Box style={styles.contentContainer}>
            <View
              path={this.props.path}
              routePath={this.props.routePath}
              onLoadingStateChange={this._onLoadingStateChange}
            />
          </Kb.Box>
          {this.state.loading && <Kb.ProgressIndicator style={styles.loading} />}
        </Kb.Box>
        <Footer />
      </Kb.Box>
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
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.flexGrow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.blue5,
    flex: 1,
    justifyContent: 'center',
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
  outerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    height: '100%',
    position: 'relative',
  },
})
