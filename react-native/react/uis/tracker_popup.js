'use strict'

import * as Constants from '../constants/login2'
import QRCodeGen from 'qrcode-generator'
import { navigateTo, routeAppend, getCurrentURI, getCurrentTab } from './router'
import engine from '../engine'
import enums from '../keybase_v1'
import UserPass from '../login2/register/user-pass'
import PaperKey from '../login2/register/paper-key'
import CodePage from '../login2/register/code-page'
import ExistingDevice from '../login2/register/existing-device'
import SetPublicName from '../login2/register/set-public-name'
import { switchTab } from './tabbed-router'
import { devicesTab } from '../constants/tabs'
import { loadDevices } from './devices'

exports function trackerPopup (param, {start,end}) {

	const incomingMap = {
		"keybase.1.identifyUi.displayKey" : (param, response) => {
			reponse.result()
		},

		"keybase.1.identifyUi.finish" : (param, response) => {
			// Unregister these hooks, ending this 'session'.
			end()
			response.result()
		}
	}

	// Register all of the above hooks
	start(incomingMap)
}

export function enableDelegateUIs () {
	engine.listenOnConnect(() => {
		engine.rpc("delegateUICtl.registerIdentifyUI", {}, {}, (error, response) => {})
	})
}

export function bindDelegateUIs () {
	engine.listenDelegateUI("keybase.1.identifyUi.makeUI", trackerPopup)
}
