// @flow
import * as I from 'immutable'
import {mapProps} from '../../util/container'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import {Box, ProgressIndicator} from '../../common-adapters'
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

class NormalPreview extends React.PureComponent<NormalPreviewProps, State> {
  state = {
    loading: false,
  }

  _onLoadingStateChange = (loading: boolean) => this.setState({loading})

  render() {
    return (
      <Box style={styles.outerContainer}>
        <Header path={this.props.path} routePath={this.props.routePath} />
        <Box style={styles.greyContainer}>
          <Box style={styles.contentContainer}>
            <View
              path={this.props.path}
              routePath={this.props.routePath}
              onLoadingStateChange={this._onLoadingStateChange}
            />
          </Box>
          {this.state.loading && <ProgressIndicator style={styles.loading} />}
        </Box>
        <Footer />
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  outerContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    height: '100%',
    position: 'relative',
  },
  greyContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    ...Styles.globalStyles.flexGrow,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: Styles.globalColors.blue5,
  },
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
  loading: Styles.platformStyles({
    common: {
      height: 32,
      width: 32,
    },
    isElectron: {
      position: 'absolute',
      top: 86,
      left: 40,
    },
    isMobile: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
  }),
})

// TODO: figure out typing here
export default mapProps<any, any>(
  ({routePath, routeProps}) => ({
    path: Types.stringToPath(routeProps.get('path') || Constants.defaultPath),
    routePath,
  })
)(NormalPreview)
