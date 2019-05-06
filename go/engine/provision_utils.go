package engine

import (
	"fmt"
	"os"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol/keybase1"
)

// ephemeralKeyReboxer will rebox the lastest userEK while provisioning
// devices.  The provisionee generates a deviceEK seed so that the provisioner
// can rebox the latest userEK for the new deviceKID.  The provisionee posts
// the userEKBox and deviceEKStatement when posting the new device keys.  Once
// fully provisioned the provisionee saves the new deviceEK to storage,
// encrypted by the newly created device.
type ephemeralKeyReboxer struct {
	deviceEKSeed      keybase1.Bytes32
	seedGenerated     bool
	deviceEKStatement keybase1.DeviceEkStatement
	userEKBox         *keybase1.UserEkBoxed
}

func newEphemeralKeyReboxer() *ephemeralKeyReboxer {
	return &ephemeralKeyReboxer{}
}

func (e *ephemeralKeyReboxer) getDeviceEKSeed(mctx libkb.MetaContext) (err error) {
	if ekLib := mctx.G().GetEKLib(); ekLib != nil && !e.seedGenerated {
		e.deviceEKSeed, err = ekLib.NewEphemeralSeed()
		if err != nil {
			return err
		}
		e.seedGenerated = true
	}
	return nil
}

func (e *ephemeralKeyReboxer) getDeviceEKKID(mctx libkb.MetaContext) (kid keybase1.KID, err error) {
	if !e.seedGenerated {
		if err := e.getDeviceEKSeed(mctx); err != nil {
			return "", err
		}
	}
	if ekLib := mctx.G().GetEKLib(); ekLib != nil {
		ekPair := ekLib.DeriveDeviceDHKey(e.deviceEKSeed)
		return ekPair.GetKID(), nil
	}
	return "", nil
}

func (e *ephemeralKeyReboxer) getReboxArg(mctx libkb.MetaContext, userEKBox *keybase1.UserEkBoxed,
	deviceID keybase1.DeviceID, signingKey libkb.GenericKey) (userEKReboxArg *keybase1.UserEkReboxArg, err error) {
	defer mctx.Trace("ephemeralKeyReboxer#getReboxArg", func() error { return err })()

	ekLib := mctx.G().GetEKLib()
	if ekLib == nil {
		return nil, nil
	}

	if userEKBox == nil { // We will create EKs after provisioning in the normal way
		mctx.Debug("userEKBox nil, no ephemeral keys created during provisioning")
		return nil, nil
	}

	deviceEKStatement, deviceEKStatementSig, err := ekLib.SignedDeviceEKStatementFromSeed(
		mctx, userEKBox.DeviceEkGeneration, e.deviceEKSeed, signingKey)
	if err != nil {
		return nil, err
	}

	userEKReboxArg = &keybase1.UserEkReboxArg{
		UserEkBoxMetadata: keybase1.UserEkBoxMetadata{
			Box:                 userEKBox.Box,
			RecipientDeviceID:   deviceID,
			RecipientGeneration: userEKBox.DeviceEkGeneration,
		},
		DeviceID:             deviceID,
		DeviceEkStatementSig: deviceEKStatementSig,
	}

	e.deviceEKStatement = deviceEKStatement
	e.userEKBox = userEKBox

	return userEKReboxArg, nil
}

func (e *ephemeralKeyReboxer) storeEKs(mctx libkb.MetaContext) (err error) {
	defer mctx.Trace("ephemeralKeyReboxer#storeEKs", func() error { return err })()
	if ekLib := mctx.G().GetEKLib(); ekLib == nil {
		return nil
	}
	if e.userEKBox == nil {
		mctx.Debug("userEKBox nil, no ephemeral keys to store")
		return nil
	}

	if !e.seedGenerated {
		return fmt.Errorf("Unable to store EKs with out generating a seed first")
	}

	deviceEKStorage := mctx.G().GetDeviceEKStorage()
	metadata := e.deviceEKStatement.CurrentDeviceEkMetadata
	if err = deviceEKStorage.Put(mctx, metadata.Generation, keybase1.DeviceEk{
		Seed:     e.deviceEKSeed,
		Metadata: metadata,
	}); err != nil {
		return err
	}

	userEKBoxStorage := mctx.G().GetUserEKBoxStorage()
	return userEKBoxStorage.Put(mctx, e.userEKBox.Metadata.Generation, *e.userEKBox)
}

func makeUserEKBoxForProvisionee(mctx libkb.MetaContext, KID keybase1.KID) (*keybase1.UserEkBoxed, error) {
	ekLib := mctx.G().GetEKLib()
	if ekLib == nil {
		return nil, nil
	}
	ekPair, err := libkb.ImportKeypairFromKID(KID)
	if err != nil {
		return nil, err
	}
	receiverKey, ok := ekPair.(libkb.NaclDHKeyPair)
	if !ok {
		return nil, fmt.Errorf("Unexpected receiver key type")
	}
	// This is hardcoded to 1 since we're provisioning a new device.
	deviceEKGeneration := keybase1.EkGeneration(1)
	return ekLib.BoxLatestUserEK(mctx, receiverKey, deviceEKGeneration)
}

func verifyLocalStorage(m libkb.MetaContext, username string, uid keybase1.UID) {
	m.Debug("verifying local storage")
	defer m.Debug("done verifying local storage")
	normUsername := libkb.NewNormalizedUsername(username)

	// check config.json looks ok
	verifyRegularFile(m, "config", m.G().Env.GetConfigFilename())
	cr := m.G().Env.GetConfig()
	if cr.GetUsername() != normUsername {
		m.Debug("config username %q doesn't match engine username %q", cr.GetUsername(), normUsername)
	}
	if cr.GetUID().NotEqual(uid) {
		m.Debug("config uid %q doesn't match engine uid %q", cr.GetUID(), uid)
	}

	// check keys in secretkeys.mpack
	verifyRegularFile(m, "secretkeys", m.G().SKBFilenameForUser(normUsername))

	// check secret stored
	secret, err := m.G().SecretStore().RetrieveSecret(m, normUsername)
	if err != nil {
		m.Debug("failed to retrieve secret for %s: %s", username, err)
	}
	if secret.IsNil() || len(secret.Bytes()) == 0 {
		m.Debug("retrieved nil/empty secret for %s", username)
	}
}

func verifyRegularFile(m libkb.MetaContext, name, filename string) {
	info, err := os.Stat(filename)
	if err != nil {
		m.Debug("stat %s file %q error: %s", name, filename, err)
		return
	}

	m.Debug("%s file %q size: %d", name, filename, info.Size())
	if !info.Mode().IsRegular() {
		m.Debug("%s file %q not regular: %s", name, filename, info.Mode())
	}
}
