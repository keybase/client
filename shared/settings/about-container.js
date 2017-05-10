// @flow
import About from './about'
import {HeaderHoc} from '../common-adapters'
import {connect} from 'react-redux'
import {version} from '../constants/platform'
import {defaultProps, compose} from 'recompose'

import type {Dispatch} from '../constants/types/flux'

const mapDispatchToProps = (
  dispatch: Dispatch,
  {navigateUp, navigateAppend}
) => ({
  onBack: () => dispatch(navigateUp()),
  onShowPrivacyPolicy: () =>
    dispatch(
      navigateAppend([
        {
          selected: 'privacyPolicy',
          props: {
            title: 'Privacy Policy',
            source: {
              uri: 'https://keybase.io/_/webview/privacypolicy',
            },
          },
        },
      ])
    ),
  onShowTerms: () =>
    dispatch(
      navigateAppend([
        {
          selected: 'terms',
          props: {
            title: 'Terms',
            source: {uri: 'https://keybase.io/_/webview/terms'},
          },
        },
      ])
    ),
  title: 'About',
})

const connectedHeaderHoc = compose(
  connect(null, mapDispatchToProps),
  HeaderHoc,
  defaultProps({version})
)(About)

export default connectedHeaderHoc
