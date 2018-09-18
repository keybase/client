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
	libkb.MetaContextified
	deviceEKSeed      keybase1.Bytes32
	seedGenerated     bool
	deviceEKStatement keybase1.DeviceEkStatement
	userEKBox         *keybase1.UserEkBoxed
}

func newEphemeralKeyReboxer(m libkb.MetaContext) *ephemeralKeyReboxer {
	return &ephemeralKeyReboxer{
		MetaContextified: libkb.NewMetaContextified(m),
	}
}

func (e *ephemeralKeyReboxer) getDeviceEKSeed() (err error) {
	if ekLib := e.G().GetEKLib(); ekLib != nil && !e.seedGenerated {
		e.deviceEKSeed, err = ekLib.NewEphemeralSeed()
		if err != nil {
			return err
		}
		e.seedGenerated = true
	}
	return nil
}

func (e *ephemeralKeyReboxer) getDeviceEKKID() (kid keybase1.KID, err error) {
	if !e.seedGenerated {
		if err := e.getDeviceEKSeed(); err != nil {
			return "", err
		}
	}
	if ekLib := e.G().GetEKLib(); ekLib != nil {
		ekPair := ekLib.DeriveDeviceDHKey(e.deviceEKSeed)
		return ekPair.GetKID(), nil
	}
	return "", nil
}

func (e *ephemeralKeyReboxer) getReboxArg(m libkb.MetaContext, userEKBox *keybase1.UserEkBoxed,
	deviceID keybase1.DeviceID, signingKey libkb.GenericKey) (userEKReboxArg *keybase1.UserEkReboxArg, err error) {
	defer m.CTrace("ephemeralKeyReboxer#getReboxArg", func() error { return err })()

	ekLib := m.G().GetEKLib()
	if ekLib == nil {
		return nil, nil
	}

	if userEKBox == nil { // We will create EKs after provisioning in the normal way
		m.CDebugf("userEKBox nil, no ephemeral keys created during provisioning")
		return nil, nil
	}

	deviceEKStatement, deviceEKStatementSig, err := ekLib.SignedDeviceEKStatementFromSeed(
		m.Ctx(), userEKBox.DeviceEkGeneration, e.deviceEKSeed, signingKey)
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

func (e *ephemeralKeyReboxer) storeEKs(m libkb.MetaContext) (err error) {
	defer m.CTrace("ephemeralKeyReboxer#storeEKs", func() error { return err })()
	ekLib := m.G().GetEKLib()
	if ekLib == nil {
		return nil
	}
	if e.userEKBox == nil {
		m.CDebugf("userEKBox nil, no ephemeral keys to store")
		return nil
	}

	if !e.seedGenerated {
		return fmt.Errorf("Unable to store EKs with out generating a seed first")
	}

	deviceEKStorage := m.G().GetDeviceEKStorage()
	metadata := e.deviceEKStatement.CurrentDeviceEkMetadata
	if err = deviceEKStorage.Put(m.Ctx(), metadata.Generation, keybase1.DeviceEk{
		Seed:     e.deviceEKSeed,
		Metadata: metadata,
	}); err != nil {
		return err
	}

	userEKBoxStorage := m.G().GetUserEKBoxStorage()
	return userEKBoxStorage.Put(m.Ctx(), e.userEKBox.Metadata.Generation, *e.userEKBox)
}

func makeUserEKBoxForProvisionee(m libkb.MetaContext, KID keybase1.KID) (*keybase1.UserEkBoxed, error) {
	ekLib := m.G().GetEKLib()
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
	return ekLib.BoxLatestUserEK(m.Ctx(), receiverKey, deviceEKGeneration)
}

func verifyLocalStorage(m libkb.MetaContext, username string, uid keybase1.UID) {
	m.CDebugf("verifying local storage")
	defer m.CDebugf("done verifying local storage")
	normUsername := libkb.NewNormalizedUsername(username)

	// check config.json looks ok
	verifyRegularFile(m, "config", m.G().Env.GetConfigFilename())
	cr := m.G().Env.GetConfig()
	if cr.GetUsername() != normUsername {
		m.CDebugf("config username %q doesn't match engine username %q", cr.GetUsername(), normUsername)
	}
	if cr.GetUID().NotEqual(uid) {
		m.CDebugf("config uid %q doesn't match engine uid %q", cr.GetUID(), uid)
	}

	// check keys in secretkeys.mpack
	verifyRegularFile(m, "secretkeys", m.G().SKBFilenameForUser(normUsername))

	// check secret stored
	secret, err := m.G().SecretStore().RetrieveSecret(m, normUsername)
	if err != nil {
		m.CDebugf("failed to retrieve secret for %s: %s", username, err)
	}
	if secret.IsNil() || len(secret.Bytes()) == 0 {
		m.CDebugf("retrieved nil/empty secret for %s", username)
	}
}

func verifyRegularFile(m libkb.MetaContext, name, filename string) {
	info, err := os.Stat(filename)
	if err != nil {
		m.CDebugf("stat %s file %q error: %s", name, filename, err)
		return
	}

	m.CDebugf("%s file %q size: %d", name, filename, info.Size())
	if !info.Mode().IsRegular() {
		m.CDebugf("%s file %q not regular: %s", name, filename, info.Mode())
	}
}
