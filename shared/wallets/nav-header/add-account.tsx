import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type AddAccountProps = {
  onAddNew: () => void
  onLinkExisting: () => void
}

const _AddAccount = (props: Kb.PropsWithOverlay<AddAccountProps>) => (
  <>
    <Kb.Button
      ref={props.setAttachmentRef}
      type="Wallet"
      mode="Secondary"
      small={true}
      fullWidth={true}
      onClick={props.toggleShowingMenu}
      label="Add an account"
    />
    <Kb.FloatingMenu
      items={[
        {
          onClick: props.onAddNew,
          title: 'Create a new account',
        },
        {
          onClick: props.onLinkExisting,
          title: 'Link an existing Stellar account',
        },
      ]}
      visible={props.showingMenu}
      attachTo={props.getAttachmentRef}
      closeOnSelect={true}
      onHidden={props.toggleShowingMenu}
      position="bottom center"
    />
  </>
)
const AddAccount = Kb.OverlayParentHOC(_AddAccount)

const mapDispatchToProps = dispatch => ({
  onAddNew: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {backButton: false, showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  },
  onLinkExisting: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
    )
  },
})

export default Container.namedConnect(() => ({}), mapDispatchToProps, (_, d) => d, 'WalletAddAccount')(
  AddAccount
)
