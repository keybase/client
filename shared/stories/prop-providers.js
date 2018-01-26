// @flow
import {action, createPropProvider} from './storybook'

/*
 * Some common prop provider creators.
 *
 *  Params: specific pieces of data (not necessarily store data)
 *          that are needed to derive view props
 *  Output: a <Provider /> that can be used to wrap a storybook
 *          entry by using `addDecorator(provider)` before adding
 *          any stories
 */

const Usernames = (following: string[], you?: string) =>
  createPropProvider({
    Usernames: props => {
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

export {Usernames}
