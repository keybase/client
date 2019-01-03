// @flow
import * as Constants from '../constants/wallets'
import {makeLeafTags} from '../route-tree'
import {isMobile} from '../constants/platform'

// stash in here so we only `require` everything once
let loaded = null

const routeTree = () => {
  if (loaded) {
    return loaded
  }

  const SendForm = require('./send-form/container').default
  const QRScan = require('./qr-scan/container').default
  const ConfirmForm = require('./confirm-form/container').default
  const CreateNewAccount = require('./create-account/container').default
  const LinkExisting = require('./link-existing/container').default
  const ChooseAsset = require('./send-form/choose-asset/container').default

  const createNewAccount = {
    children: {},
    component: CreateNewAccount,
    tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
  }

  const linkExisting = {
    children: {},
    component: LinkExisting,
    tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
  }

  loaded = {
    children: {
      [Constants.confirmFormRouteKey]: {
        children: {},
        component: ConfirmForm,
        tags: makeLeafTags({
          layerOnTop: !isMobile,
          renderTopmostOnly: true,
          underNotch: true,
        }),
      },
      createNewAccount,
      linkExisting,
      [Constants.chooseAssetFormRouteKey]: {
        children: {},
        component: ChooseAsset,
        tags: makeLeafTags({layerOnTop: !isMobile, renderTopmostOnly: true}),
      },
      qrScan: {
        component: QRScan,
        tags: makeLeafTags({layerOnTop: true, underNotch: true}),
      },
    },
    component: SendForm,
    tags: makeLeafTags({
      layerOnTop: !isMobile,
      renderTopmostOnly: true,
      underNotch: true,
    }),
  }
  return loaded
}

export default routeTree
