// @flow
import * as PushNotifications from 'react-native-push-notification'
import {PushNotificationIOS, CameraRoll, ActionSheetIOS, AsyncStorage, Linking} from 'react-native'
import * as PushConstants from '../constants/push'
import {eventChannel} from 'redux-saga'
import {isIOS} from '../constants/platform'
import {isDevApplePushToken} from '../local-debug'
import {chatTab} from '../constants/tabs'
import {setInitialTab, setInitialLink} from './config'
import {setInitialConversation} from './chat'

import type {AsyncAction} from '../constants/types/flux'

function requestPushPermissions(): Promise<*> {
  return PushNotifications.requestPermissions()
}

function showMainWindow() {
  return () => {
    // nothing
  }
}

function showShareActionSheet(options: {
  url?: ?any,
  message?: ?any,
}): Promise<{completed: boolean, method: string}> {
  if (isIOS) {
    return new Promise((resolve, reject) =>
      ActionSheetIOS.showShareActionSheetWithOptions(options, reject, resolve)
    )
  } else {
    console.warn('Sharing action not implemented in android')
    return Promise.resolve({completed: false, method: ''})
  }
}

type NextURI = string
function saveAttachmentDialog(filePath: string): Promise<NextURI> {
  return CameraRoll.saveToCameraRoll(filePath)
}

function configurePush() {
  return eventChannel(emitter => {
    PushNotifications.configure({
      onRegister: token => {
        let tokenType: ?PushConstants.TokenType
        switch (token.os) {
          case 'ios':
            tokenType = isDevApplePushToken ? PushConstants.tokenTypeAppleDev : PushConstants.tokenTypeApple
            break
          case 'android':
            tokenType = PushConstants.tokenTypeAndroidPlay
            break
        }
        if (tokenType) {
          emitter(
            ({
              payload: {
                token: token.token,
                tokenType,
              },
              type: 'push:pushToken',
            }: PushConstants.PushToken)
          )
        } else {
          emitter(
            ({
              payload: {
                error: new Error('Unrecognized os for token:', token),
              },
              type: 'push:registrationError',
            }: PushConstants.PushRegistrationError)
          )
        }
      },
      senderID: PushConstants.androidSenderID,
      onNotification: notification => {
        emitter(
          ({
            payload: notification,
            type: 'push:notification',
          }: PushConstants.PushNotificationAction)
        )
      },
      onError: error => {
        emitter(
          ({
            payload: {error},
            type: 'push:error',
          }: PushConstants.PushError)
        )
      },
      // Don't request permissions for ios, we'll ask later, after showing UI
      requestPermissions: !isIOS,
    })
    // It doesn't look like there is a registrationError being set for iOS.
    // https://github.com/zo0r/react-native-push-notification/issues/261
    PushNotificationIOS.addEventListener('registrationError', error => {
      emitter(
        ({
          payload: {error},
          type: 'push:registrationError',
        }: PushConstants.PushRegistrationError)
      )
    })

    console.log('Check push permissions')
    if (isIOS) {
      PushNotifications.checkPermissions(permissions => {
        console.log('Push checked permissions:', permissions)
        if (!permissions.alert) {
          // TODO(gabriel): Detect if we already showed permissions prompt and were denied,
          // in which case we should not show prompt or show different prompt about enabling
          // in Settings (for iOS)
          emitter(
            ({
              payload: true,
              type: 'push:permissionsPrompt',
              logTransformer: action => ({
                payload: action.payload,
                type: action.type,
              }),
            }: PushConstants.PushPermissionsPrompt)
          )
        } else {
          // We have permissions, this triggers a token registration in
          // case it changed.
          emitter(
            ({
              payload: undefined,
              type: 'push:permissionsRequest',
            }: PushConstants.PushPermissionsRequest)
          )
        }
      })
    }

    // TODO make some true unsubscribe function
    return () => {}
  })
}

function persistRouteState(): AsyncAction {
  return (dispatch, getState) => {
    const routeState = getState().routeTree.routeState
    const toWrite = {}

    const selectedTab = routeState.selected
    if (selectedTab) {
      toWrite.tab = selectedTab
    }

    if (selectedTab === chatTab) {
      const tab = routeState.children.get(chatTab)
      if (tab && tab.selected) {
        toWrite.selectedConversationIDKey = tab.selected
      }
    }

    AsyncStorage.setItem('routeState', JSON.stringify(toWrite))
  }
}

function loadRouteState(): AsyncAction {
  return (dispatch, getState) => {
    let foundLink = false
    Linking.getInitialURL()
      .then(url => {
        if (url) {
          foundLink = true
          dispatch(setInitialLink(url))
        }
      })
      .catch(_ => {})
      .finally(() => {
        if (!foundLink) {
          AsyncStorage.getItem('routeState', (err, s) => {
            if (!err && s) {
              try {
                const item = JSON.parse(s)
                //
                // Before we actually nav to the saved routeState, we should clear
                // it for future runs of the app.  That way, if the act of navigating
                // to this route causes a crash for some reason, we won't get stuck
                // in a loop of trying to restore the bad state every time we launch.
                AsyncStorage.setItem('routeState', '', err => {
                  err && console.warn('Error clearing routeState:', err)
                })

                if (item.tab) {
                  dispatch(setInitialTab(item.tab))
                }

                if (item.selectedConversationIDKey) {
                  dispatch(setInitialConversation(item.selectedConversationIDKey))
                }
              } catch (_) {}
            }
          })
        }
      })
  }
}

export {
  loadRouteState,
  persistRouteState,
  requestPushPermissions,
  showMainWindow,
  configurePush,
  saveAttachmentDialog,
  showShareActionSheet,
}
