import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type AddAccountProps = {
  onAddNew: () => void
  onLinkExisting: () => void
}

const AddAccount = (props: AddAccountProps) => {
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      items={[
        {
          icon: 'iconfont-new',
          onClick: props.onAddNew,
          title: 'Create a new account',
        },
        {
          icon: 'iconfont-identity-stellar',
          onClick: props.onLinkExisting,
          title: 'Link an existing Stellar account',
        },
      ]}
      visible={showingPopup}
      attachTo={attachTo}
      closeOnSelect={true}
      onHidden={toggleShowingPopup}
      position="bottom center"
    />
  ))
  return (
    <>
      <Kb.Button
        ref={popupAnchor}
        type="Wallet"
        mode="Secondary"
        small={true}
        fullWidth={true}
        onClick={toggleShowingPopup}
        label="Add an account"
      />
      {popup}
    </>
  )
}

const mapDispatchToProps = dispatch => ({
  onAddNew: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {showOnCreation: true}, selected: 'createNewAccount'}],
      })
    )
  },
  onLinkExisting: () => {
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {showOnCreation: true}, selected: 'linkExisting'}]})
    )
  },
})

export default Container.connect(
  () => ({}),
  mapDispatchToProps,
  (_, d) => d
)(AddAccount)
