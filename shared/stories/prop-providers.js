// @flow
import {action, createPropProvider} from './storybook'

/**
 * Compose prop factories into a single provider
 * @param {Array<SelectorMap>} providers An array of objects of the form { DisplayName: Function(ownProps) }
 *                      that are combined in the output
 * @returns a <Provider /> that can be used in a storybook `addDecorator` to provide viewProps
 *          for connected child components
 */
const compose = (...providers: any[]) => {
  return createPropProvider(providers.reduce((obj, provider) => ({...obj, ...provider}), {}))
}

/**
 * Some common prop factory creators.
 *
 *  Params: specific pieces of data (not necessarily store data)
 *          that are needed to derive view props
 *  Output: a map of DisplayName: Function(...) that returns the
 *          view props the connected component is concerned with
 */

const Usernames = (following: string[], you?: string) => ({
  Usernames: (props: any) => {
    const {usernames} = props
    const users = usernames.map(username => ({
      username,
      following: following.includes(username),
      you: you ? username === you : false,
    }))
    return {
      ...props,
      users,
      onUsernameClicked: action('onUsernameClicked'),
    }
  },
})

export {compose, Usernames}
