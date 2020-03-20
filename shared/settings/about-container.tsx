import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import About from './about'
import {HeaderHoc} from '../common-adapters'
import {version} from '../constants/platform'

type OwnProps = {}

const connectedHeaderHoc = Container.connect(
  () => ({version}),
  dispatch => ({
    onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
    onShowPrivacyPolicy: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {title: 'Privacy Policy', url: 'https://keybase.io/_/webview/privacypolicy'},
              selected: 'privacyPolicy',
            },
          ],
        })
      ),
    onShowTerms: () =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {title: 'Terms', url: 'https://keybase.io/_/webview/terms'},
              selected: 'terms',
            },
          ],
        })
      ),
    title: 'About',
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(HeaderHoc(About))

export default connectedHeaderHoc
