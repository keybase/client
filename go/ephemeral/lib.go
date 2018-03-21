package ephemeral

import (
	"context"
	"fmt"
	"sync"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

type EKLib struct {
	libkb.Contextified
	sync.Mutex
}

func NewEKLib(g *libkb.GlobalContext) *EKLib {
	return &EKLib{
		Contextified: libkb.NewContextified(g),
	}
}

func (e *EKLib) KeygenIfNeeded(ctx context.Context) (err error) {
	defer e.G().CTrace(ctx, "KeygenIfNeeded", func() error { return err })()
	e.Lock()
	defer e.Unlock()

	if loggedIn, err := e.G().LoginState().LoggedInLoad(); err != nil {
		return err
	} else if !loggedIn {
		return fmt.Errorf("Aborting ephemeral key generation, user is not logged in!")
	}

	merkleRootPtr, err := e.G().GetMerkleClient().FetchRootFromServer(ctx, libkb.EphemeralKeyMerkleFreshness)
	if err != nil {
		return err
	}
	merkleRoot := *merkleRootPtr

	deviceEKNeeded, err := e.newDeviceEKNeeded(ctx, merkleRoot)
	if err != nil {
		return err
	}
	if deviceEKNeeded {
		_, err = publishNewDeviceEK(ctx, e.G(), merkleRoot)
		if err != nil {
			return err
		}
	}

	userEKNeeded, err := e.newUserEKNeeded(ctx, merkleRoot)
	if err != nil {
		return err
	}

	if userEKNeeded {
		_, err = publishNewUserEK(ctx, e.G(), merkleRoot)
		if err != nil {
			return err
		}
	}
	return e.CleanupStaleUserAndDeviceEKs(ctx, merkleRoot)
}

func (e *EKLib) CleanupStaleUserAndDeviceEKs(ctx context.Context, merkleRoot libkb.MerkleRoot) (err error) {
	defer e.G().CTrace(ctx, "CleanupStaleUserAndDeviceEKs", func() error { return err })()

	epick := libkb.FirstErrorPicker{}

	deviceEKStorage := e.G().GetDeviceEKStorage()
	_, err = deviceEKStorage.DeleteExpired(ctx, merkleRoot)
	epick.Push(err)

	userEKBoxStorage := e.G().GetUserEKBoxStorage()
	_, err = userEKBoxStorage.DeleteExpired(ctx, merkleRoot)
	epick.Push(err)
	return epick.Error()
}

func (e *EKLib) newDeviceEKNeeded(ctx context.Context, merkleRoot libkb.MerkleRoot) (needed bool, err error) {
	s := e.G().GetDeviceEKStorage()
	maxGeneration, err := s.MaxGeneration(ctx)
	if err != nil {
		return needed, err
	}
	if maxGeneration < 0 {
		return true, nil
	}

	ek, err := s.Get(ctx, maxGeneration)
	if err != nil {
		return needed, err
	}

	return keybase1.Time(merkleRoot.Ctime())-ek.Metadata.Ctime >= KeyGenLifetimeSecs, nil
}

func (e *EKLib) newUserEKNeeded(ctx context.Context, merkleRoot libkb.MerkleRoot) (needed bool, err error) {
	s := e.G().GetUserEKBoxStorage()
	maxGeneration, err := s.MaxGeneration(ctx)
	if err != nil {
		return needed, err
	}
	if maxGeneration < 0 {
		return true, nil
	}

	ek, err := s.Get(ctx, maxGeneration)
	if err != nil {
		return needed, err
	}

	return keybase1.Time(merkleRoot.Ctime())-ek.Metadata.Ctime >= KeyGenLifetimeSecs, nil
}

func (e *EKLib) OnLogin() error {
	return e.KeygenIfNeeded(context.Background())
}

func (e *EKLib) OnLogout() error {
	deviceEKStorage := e.G().GetDeviceEKStorage()
	if deviceEKStorage != nil {
		deviceEKStorage.ClearCache()
	}
	return nil
}
