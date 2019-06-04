import * as Container from '../util/container'
import About from './about'
import {HeaderHoc} from '../common-adapters'
import {version} from '../constants/platform'

type OwnProps = Container.RouteProps<{}, {}>

const mapStateToProps = () => ({version})
const mapDispatchToProps = (dispatch, {navigateUp, navigateAppend}) => ({
  onBack: () => dispatch(navigateUp()),
  onShowPrivacyPolicy: () =>
    dispatch(
      navigateAppend([
        {
          props: {source: {uri: 'https://keybase.io/_/webview/privacypolicy'}, title: 'Privacy Policy'},
          selected: 'privacyPolicy',
        },
      ])
    ),
  onShowTerms: () =>
    dispatch(
      navigateAppend([
        {props: {source: {uri: 'https://keybase.io/_/webview/terms'}, title: 'Terms'}, selected: 'terms'},
      ])
    ),
  title: 'About',
})

const connectedHeaderHoc = Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  HeaderHoc
  // @ts-ignore
)(About)

export default connectedHeaderHoc
