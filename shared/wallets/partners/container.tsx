import * as Constants from '../../constants/wallets'
import * as Container from '../../util/container'
import * as IconUtils from '../../common-adapters/icon.shared'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Types from '../../constants/types/wallets'
import * as WalletsGen from '../../actions/wallets-gen'
import {IconType} from '../../common-adapters/icon.constants-gen'
import Partners from '.'

type OwnProps = {}

const transformUrl = (accountID: string, url: string, username: string): string =>
  url.replace('%{accountId}', accountID).replace('%{username}', username)

const toIconType = (iconFilename: string): IconType => {
  const iconType = iconFilename as IconType
  if (IconUtils.isValidIconType(iconType)) {
    return iconType
  } else {
    return 'iconfont-identity-stellar'
  }
}

const prepareExternalPartners = (
  externalPartners: Array<Types.PartnerUrl>,
  accountID: string,
  username: string
): Array<Types.PartnerUrl> | [] =>
  externalPartners
    .map(partner => ({
      adminOnly: partner.adminOnly,
      canPurchase: partner.canPurchase,
      description: partner.description,
      extra: partner.extra,
      iconFilename: toIconType(partner.iconFilename),
      title: partner.title,
      url: transformUrl(accountID, partner.url, username),
    }))
    .filter(p => p.canPurchase)

const mapStateToProps = (state: Container.TypedState) => {
  const accountID = Constants.getSelectedAccount(state)
  const account = Constants.getAccount(state, accountID)
  const me = state.config.username || ''
  const user = account.isDefault ? me : ''
  const externalPartners = Constants.getExternalPartners(state)
  return {
    accountID,
    externalPartners,
    user,
  }
}

export default Container.connect(
  mapStateToProps,
  dispatch => ({
    onDone: () => dispatch(RouteTreeGen.createNavigateUp()),
    refresh: () => dispatch(WalletsGen.createLoadExternalPartners()),
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    externalPartners: prepareExternalPartners(
      stateProps.externalPartners,
      stateProps.accountID,
      stateProps.user
    ),
    onDone: dispatchProps.onDone,
    refresh: dispatchProps.refresh,
  })
)(Partners)
