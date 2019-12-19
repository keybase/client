import * as React from 'react'
import * as Constants from '../../../../constants/wallets'
import * as Container from '../../../../util/container'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import {WalletSwitcher} from '.'

type OwnProps = {
  getAttachmentRef?: () => React.Component<any> | null
  showingMenu: boolean
  hideMenu: () => void
}

export default Container.connect(
  state => ({
    accounts: Constants.getAccountIDs(state),
  }),
  dispatch => ({
    onAddNew: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {props: {backButton: Container.isMobile, showOnCreation: true}, selected: 'createNewAccount'},
          ],
        })
      )
    },
    onLinkExisting: () => {
      dispatch(
        RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
      )
    },
    onWhatIsStellar: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['whatIsStellarModal']})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    accountIDs: stateProps.accounts,
    onAddNew: dispatchProps.onAddNew,
    onLinkExisting: dispatchProps.onLinkExisting,
    onWhatIsStellar: dispatchProps.onWhatIsStellar,
    ...ownProps,
  })
)(WalletSwitcher)
