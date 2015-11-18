export default {
  'keybase.1.secretUi.getPassphrase': (payload) => {
    console.log('Asked for passphrase')
    /*
    Payload looks like:
    { pinentry:
      { features:
        { secretStorage:
          { allow: true, label: 'store your test passphrase' }
        },
        prompt: 'Enter a test passphrase',
        retryLabel: '',
        windowTitle: 'Keybase Test Passphrase' },
        sessionID: 0
      }
    }
    */
    if (!('pinentry' in payload)) {
      console.error('Passphrase payload has no pinentry object.')
    } else if (!('features' in payload.pinentry)) {
      console.error('payload.pinentry.features does not exist')
    } else if (!('prompt' in payload.pinentry)) {
      console.error('payload.pinentry.prompt does not exist')
    }

    var props = {}
    props.prompt = payload.pinentry.prompt
    props.retryLabel = payload.pinentry.retryLabel
    props.windowTitle = payload.pinentry.windowTitle
    props.features = {}
    for (const feature in payload.pinentry.features) {
      props.features[feature] = payload.pinentry.features[feature]
    }
  }
}
