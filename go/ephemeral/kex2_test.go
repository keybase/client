package ephemeral

import (
	"context"
	"crypto/rand"
	"fmt"
	"sync"
	"testing"

	"github.com/keybase/client/go/engine"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/kex2"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

func TestKex2Provision(t *testing.T) {
	subTestKex2Provision(t, false /* upgradePerUserKey */)
}

func TestKex2ProvisionPUK(t *testing.T) {
	subTestKex2Provision(t, true /* upgradePerUserKey */)
}

func subTestKex2Provision(t *testing.T, upgradePerUserKey bool) {
	// device X (provisioner) context:
	tcX := libkb.SetupTest(t, "kex2provision", 2)
	defer tcX.Cleanup()
	tcX.Tp.DisableUpgradePerUserKey = !upgradePerUserKey
	NewEphemeralStorageAndInstall(tcX.G)

	// provisioner needs to be logged in
	userX, err := kbtest.CreateAndSignupFakeUser("X", tcX.G)
	require.NoError(t, err)
	// provisioner needs to be logged in
	err = userX.Login(tcX.G)
	require.NoError(t, err)

	// If we don't have a PUK, we can't make any EKs.
	if upgradePerUserKey {
		// The test user has a PUK, but it's not automatically loaded. We have to
		// explicitly sync it.
		keyring, err := tcX.G.GetPerUserKeyring()
		require.NoError(t, err)
		err = keyring.Sync(context.Background())
		require.NoError(t, err)

		ekLib := tcX.G.GetEKLib()
		err = ekLib.KeygenIfNeeded(context.Background())
		require.NoError(t, err)
	}

	// After the provision, Y should have access to this userEK generation
	userEKBoxStorageX := tcX.G.GetUserEKBoxStorage()
	userEKGenX, err := userEKBoxStorageX.MaxGeneration(context.Background())
	require.NoError(t, err)

	var userEKX keybase1.UserEk
	if upgradePerUserKey {
		require.True(t, userEKGenX > 0)
		userEKX, err = userEKBoxStorageX.Get(context.Background(), userEKGenX)
		require.NoError(t, err)
	} else {
		require.EqualValues(t, userEKGenX, -1)
	}

	// device Y (provisionee) context:
	tcY := libkb.SetupTest(t, "kex2provision", 2)
	defer tcY.Cleanup()
	tcY.Tp.DisableUpgradePerUserKey = !upgradePerUserKey
	NewEphemeralStorageAndInstall(tcY.G)

	var secretX kex2.Secret
	_, err = rand.Read(secretX[:])
	require.NoError(t, err)

	var secretY kex2.Secret
	_, err = rand.Read(secretY[:])
	require.NoError(t, err)

	var wg sync.WaitGroup

	// start provisionee
	wg.Add(1)
	go func() {
		defer wg.Done()

		f := func(lctx libkb.LoginContext) error {

			ctx := &engine.Context{
				ProvisionUI:  &kbtest.TestProvisionUI{SecretCh: make(chan kex2.Secret, 1)},
				LoginContext: lctx,
			}
			deviceID, err := libkb.NewDeviceID()
			if err != nil {
				t.Errorf("provisionee device id error: %s", err)
				return err
			}
			suffix, err := libkb.RandBytes(5)
			if err != nil {
				t.Errorf("provisionee device suffix error: %s", err)
				return err
			}
			dname := fmt.Sprintf("device_%x", suffix)
			device := &libkb.Device{
				ID:          deviceID,
				Description: &dname,
				Type:        libkb.DeviceTypeDesktop,
			}
			provisionee := engine.NewKex2Provisionee(tcY.G, device, secretY)
			if err := engine.RunEngine(provisionee, ctx); err != nil {
				t.Errorf("provisionee error: %s", err)
				return err
			}
			return nil
		}

		if err := tcY.G.LoginState().ExternalFunc(f, "Test - Kex2Provision"); err != nil {
			t.Errorf("kex2 provisionee error: %s", err)
		}
	}()

	// start provisioner
	wg.Add(1)
	go func() {
		defer wg.Done()
		ctx := &engine.Context{
			SecretUI:    userX.NewSecretUI(),
			ProvisionUI: &kbtest.TestProvisionUI{},
		}
		provisioner := engine.NewKex2Provisioner(tcX.G, secretX, nil)
		go provisioner.AddSecret(secretY)
		if err := engine.RunEngine(provisioner, ctx); err != nil {
			t.Errorf("provisioner error: %s", err)
			return
		}
	}()

	wg.Wait()

	deviceEKStorageY := tcY.G.GetDeviceEKStorage()
	maxDeviceEKGenerationY, err := deviceEKStorageY.MaxGeneration(context.Background())
	require.NoError(t, err)
	if upgradePerUserKey {
		// Confirm that Y has a deviceEK.
		require.True(t, maxDeviceEKGenerationY > 0)
		_, err = deviceEKStorageY.Get(context.Background(), maxDeviceEKGenerationY)
		require.NoError(t, err)
	} else {
		require.EqualValues(t, -1, maxDeviceEKGenerationY)
	}
	// Confirm Y has a userEK at the same generation as X. If we didn't have a
	// PUK this generation will be -1.
	userEKBoxStorageY := tcY.G.GetUserEKBoxStorage()
	userEKGenY, err := userEKBoxStorageY.MaxGeneration(context.Background())
	require.NoError(t, err)
	require.EqualValues(t, userEKGenX, userEKGenY)
	userEKY, err := userEKBoxStorageY.Get(context.Background(), userEKGenY)
	require.Equal(t, userEKY, userEKX)
}
