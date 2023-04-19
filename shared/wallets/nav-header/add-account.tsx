import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type AddAccountProps = {
  onAddNew: () => void
  onLinkExisting: () => void
}

const AddAccount = (props: AddAccountProps) => {
  const {onAddNew, onLinkExisting} = props

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.FloatingMenu
          items={[
            {
              icon: 'iconfont-new',
              onClick: onAddNew,
              title: 'Create a new account',
            },
            {
              icon: 'iconfont-identity-stellar',
              onClick: onLinkExisting,
              title: 'Link an existing Stellar account',
            },
          ]}
          visible={true}
          attachTo={attachTo}
          closeOnSelect={true}
          onHidden={toggleShowingPopup}
          position="bottom center"
        />
      )
    },
    [onAddNew, onLinkExisting]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
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
