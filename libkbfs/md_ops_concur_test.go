package libkbfs

import (
	"fmt"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

type MDOpsConcurTest struct {
	uid   keybase1.UID
	enter chan struct{}
	start chan struct{}
}

func NewMDOpsConcurTest(uid keybase1.UID) *MDOpsConcurTest {
	return &MDOpsConcurTest{
		uid:   uid,
		enter: make(chan struct{}),
		start: make(chan struct{}),
	}
}

func (m *MDOpsConcurTest) GetForHandle(ctx context.Context, handle *TlfHandle) (
	*RootMetadata, error) {
	return nil, fmt.Errorf("Not supported")
}

func (m *MDOpsConcurTest) GetForTLF(ctx context.Context, id TlfID) (
	*RootMetadata, error) {
	_, ok := <-m.enter
	if !ok {
		// Only one caller should ever get here
		return nil, fmt.Errorf("More than one caller to GetForTLF()!")
	}
	<-m.start
	dh := NewTlfHandle()
	dh.Writers = append(dh.Writers, m.uid)
	return NewRootMetadata(dh, id), nil
}

func (m *MDOpsConcurTest) Get(ctx context.Context, mdID MdID) (
	*RootMetadata, error) {
	return nil, fmt.Errorf("Not supported")
}

func (m *MDOpsConcurTest) GetSince(ctx context.Context, id TlfID, mdID MdID,
	max int) ([]*RootMetadata, bool, error) {
	return nil, false, nil
}

func (m *MDOpsConcurTest) Put(ctx context.Context, id TlfID, md *RootMetadata,
	deviceKID keybase1.KID, unmergedBase MdID) error {
	<-m.start
	<-m.enter
	md.SerializedPrivateMetadata = make([]byte, 1, 1)
	return nil
}

func (m *MDOpsConcurTest) PutUnmerged(ctx context.Context, id TlfID,
	rmd *RootMetadata, deviceKID keybase1.KID) error {
	return nil
}

func (m *MDOpsConcurTest) GetLastCommittedPoint(ctx context.Context, id TlfID,
	deviceKID keybase1.KID) (bool, MdID, error) {
	return false, MdID{0}, nil
}

func (m *MDOpsConcurTest) GetUnmergedSince(ctx context.Context, id TlfID,
	deviceKID keybase1.KID, mdID MdID, max int) ([]*RootMetadata, bool, error) {
	return nil, false, nil
}

func (m *MDOpsConcurTest) GetFavorites(ctx context.Context) ([]*TlfHandle, error) {
	return nil, nil
}
