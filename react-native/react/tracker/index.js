'use strict'
/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
import {connect} from '../base-redux'
// $FlowIssue platform dependent files
import Render from './render'
import {navigateUp} from '../actions/router'

import type { BioProps } from './bio.render.desktop'
import type { ActionProps } from './action.render.desktop'
import type { HeaderProps } from './header.render.desktop'
import type { ProofsProps } from './proofs.render.desktop'
import type { User, IdentifyOutcome } from '../constants/types/flow-types'

export default class Tracker extends Component {
class Tracker extends Component {
  constructor (props: any) {
    super(props)

    // this is TEMP since we don't have a store yet
    this.state = {
      shouldFollowChecked: props.shouldFollow
    }
  }

  render () {
    // these non-prop values will be removed during integration
    return <Render {...this.props}
      shouldFollow={this.state.shouldFollowChecked}
      followChecked={checked => this.setState({shouldFollowChecked: checked})}
      />
  }

  static parseRoute (currentPath) {
    const user: User = {
      uid: {},
      username: 'test123'
    }

    const bioProps: BioProps = {
      username: user.username,
      state: currentPath.get('state'),
      userInfo: {
        fullname: 'Alice Bonhomme-Biaias',
        followersCount: 81,
        followingCount: 567,
        followsYou: true,
        location: 'New York, NY',
        avatar: 'https://s3.amazonaws.com/keybase_processed_uploads/2571dc6108772dbe0816deef41b25705_200_200_square_200.jpeg'
      }
    }

    const actionProps: ActionProps = {
      state: currentPath.get('state'),
      username: user.username,
      shouldFollow: true,
      onClose: () => {
        console.log('onClose')
        store.dispatch(navigateUp())
      }, // TODO
      onRefollow: () => {
        console.log('onRefollow')
        store.dispatch(navigateUp())
      },
      onUnfollow: () => {
        console.log('onUnfollow')
        store.dispatch(navigateUp())
      },
      onFollowHelp: () => window.open('https://keybase.io/docs/tracking'), // TODO
      // followChecked: checked => this.setState({shouldFollowChecked: checked})
      followChecked: checked => console.log('follow checked:', checked)
    }

    const headerProps: HeaderProps = {
      reason: 'You accessed /private/cecile',
      onClose: () => {
        console.log('onClose')
        store.dispatch(navigateUp())
      }, // TODO
    }

    const proofsProps: ProofsProps = {
      proofsAndChecks: [
        [
          {"displayMarkup":"marcopolo","key":"github","mTime":1413928304000,"proofType":3,"sigID":"56363c0307325cb4eedb072be7f8a5d3b29d13f5ef33650a7e910f772ff1d3710f","value":"marcopolo"},
          {"cached":{"displayMarkup":"[cached 2015-11-17 13:47:48 PST]","proofResult":{"desc":"","state":1,"status":1},"time":1447796868323},"hint":{"apiUrl":"https://gist.githubusercontent.com/MarcoPolo/ab4113d4b3e8de4d4494/raw/21c3c064c2b4d25956c680b7c716bca28552326f/gistfile1.txt","checkText":"\n\nyMHSAnicfVFbSBRRGF7X0m0r6MHSRDAOKoqrnLntzCxiV0J6WIN8KcvlzJkz61TO\njLMXFZNYI5MgIQQtMs2oXoQQkjIKktio7IKklpBloiimRBQVkVozYm/R//Lzf//3\nffyX+MZEhzuhK/z+4LJRgROeDSxEHGV7R416IOlyHfDVg2NkJSmqFiSmYapaGPiA\nzECBhkTELMNBReEpCkmSoECFkzkiKwxCyAs5HgIPqNRDtsKykVCIFKq6hVlFQJUt\n9B/8yEqDxTQDERFkWhFpWsY0xpiyC1YQIQ9XiCFiaqiKWOwqZGLd0I/roMEDLDiq\nYmIPvdoOquHKiPQfSbjOsLEaIgVW1QFJ1WRrZUsUJWZI1TXgoywmDqu2nGIpRqQF\nBrIeQGoN1SQB1WZwvFeAVniAYZKoZSkKsiAxPCtiHioizyPrUJBiaQYJIhIVKCOJ\nYAV6vQgzFM0pWPISxcvIFCMRLytQwN6nWtOBj7HGREHLMqQGNRSOmAQ0PBw4vMaR\n4HYkrXXaT3O41236+8qkKZejc/bVi+mtrljzDlfLYGyya3gxB35p7pl94OrtSR/5\n4bx/K60gz5HVsXQjs3UuecPJhV2Fi0eT/VlvX6dNHyp94uKu5nR0xF5W74t21jRN\nRDKzd1YV535ln27vn0/ZFpsHed8fX5o944wPx6XxsYp37ETJ+v15J2pLiwfTJX7z\ngbGfMNedfSowVLDl2sfaiSNFI6k4PPkm/+7SzPLtBjnx7E3p8u+LTa7886fvLe4W\nesZJt9D2KKNvkE55PtPuPKcNNc9cp/38Utmd1OICmFLZ2f3h1+eilvKIvzpDD0Tj\noyV9yf5G0JrdPixPN14Z+ZZ+oc7tmWvqT0Of2sr3TP0BZx0Tyw==\n","humanUrl":"https://gist.github.com/ab4113d4b3e8de4d4494","remoteId":"ab4113d4b3e8de4d4494"},"proofId":1,"proofResult":{"desc":"","state":1,"status":1},"torWarning":false}
        ]
      ]
    }

    return {
      componentAtTop: {
        title: 'Tracker',
        props: {
          bioProps,
          actionProps,
          headerProps,
          proofsProps
        }
      }
    }
  }
}

Tracker.propTypes = { }

export default connect(
  null,
  dispatch => {
    return {
      onClose: () => {
        console.log('onClose')
        dispatch(navigateUp())
      }, // TODO
      onFollowHelp: () => window.open('https://keybase.io/docs/tracking'), // TODO
      onRefollow: () => {
        console.log('onRefollow')
        dispatch(navigateUp())
      },
      onUnfollow: () => {
        console.log('onUnfollow')
        dispatch(navigateUp())
      }
    }
  }
)(Tracker)
