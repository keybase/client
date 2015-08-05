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

func (m *MDOpsConcurTest) GetUnmergedForHandle(ctx context.Context, handle *TlfHandle) (
	*RootMetadata, error) {
	return nil, fmt.Errorf("Not supported")
}

func (m *MDOpsConcurTest) getForTLF(ctx context.Context, id TlfID, unmerged bool) (
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

func (m *MDOpsConcurTest) GetForTLF(ctx context.Context, id TlfID) (
	*RootMetadata, error) {
	return m.getForTLF(ctx, id, false)
}

func (m *MDOpsConcurTest) GetUnmergedForTLF(ctx context.Context, id TlfID) (
	*RootMetadata, error) {
	return m.getForTLF(ctx, id, true)
}

func (m *MDOpsConcurTest) GetRange(ctx context.Context, id TlfID,
	start, stop MetadataRevision) ([]*RootMetadata, error) {
	return nil, nil
}

func (m *MDOpsConcurTest) GetUnmergedRange(ctx context.Context, id TlfID,
	start, stop MetadataRevision) ([]*RootMetadata, error) {
	return nil, nil
}

func (m *MDOpsConcurTest) Put(ctx context.Context, md *RootMetadata) error {
	<-m.start
	<-m.enter
	md.SerializedPrivateMetadata = make([]byte, 1, 1)
	return nil
}

func (m *MDOpsConcurTest) PutUnmerged(ctx context.Context, md *RootMetadata) error {
	md.Flags |= MetadataFlagUnmerged
	return m.Put(ctx, md)
}

func (m *MDOpsConcurTest) PruneUnmerged(ctx context.Context, id TlfID) error {
	return nil
}
