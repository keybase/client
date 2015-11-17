export default {
  'keybase.1.secretUi.getPassphrase': (payload, response) => {
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

    var props = payload.pinentry
    // Here's where we should spawn a BrowserWindow with the Pinentry component,
    // passing in props.  For now, it's stubbed out.
    const reply = {
      'passphrase': 'fooBARbaz',
      'storeSecret': false
    }
    response.result(reply)
    console.log('Sent passphrase back')
  }
}
