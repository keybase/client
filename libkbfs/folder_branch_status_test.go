// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"fmt"
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfscrypto"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

func fbStatusTestInit(t *testing.T) (*gomock.Controller, *ConfigMock,
	*folderBranchStatusKeeper, *MockNodeCache) {
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	config := NewConfigMock(mockCtrl, ctr)
	nodeCache := NewMockNodeCache(mockCtrl)
	fbsk := newFolderBranchStatusKeeper(config, nodeCache)
	interposeDaemonKBPKI(config, "alice", "bob")
	return mockCtrl, config, fbsk, nodeCache
}

func fbStatusTestShutdown(mockCtrl *gomock.Controller, config *ConfigMock) {
	config.ctr.CheckForFailures()
	mockCtrl.Finish()
}

func newMockNode(mockCtrl *gomock.Controller) *MockNode {
	n := NewMockNode(mockCtrl)
	id := NewMockNodeID(mockCtrl)
	n.EXPECT().GetID().AnyTimes().Return(id)
	return n
}

func TestFBStatusSignal(t *testing.T) {
	mockCtrl, config, fbsk, nodeCache := fbStatusTestInit(t)
	defer fbStatusTestShutdown(mockCtrl, config)
	ctx := context.Background()

	_, c, err := fbsk.getStatus(ctx, nil)
	if err != nil {
		t.Fatalf("Couldn't get status: %v", err)
	}

	n := newMockNode(mockCtrl)
	p1 := path{path: []pathNode{{Name: "a1"}, {Name: "b1"}}}
	nodeCache.EXPECT().PathFromNode(mockNodeMatcher{n}).AnyTimes().Return(p1)

	fbsk.addDirtyNode(n)
	<-c

	_, c, err = fbsk.getStatus(ctx, nil)
	if err != nil {
		t.Fatalf("Couldn't get status: %v", err)
	}

	// no change should result in no signal
	fbsk.addDirtyNode(n)
	select {
	case <-c:
		t.Fatalf("Status should not have signalled a change")
	default:
	}
}

// mockNodeMatcher is needed to compare mock nodes -- for some reason
// the default equality comparison doesn't work in gomock.
type mockNodeMatcher struct {
	node *MockNode
}

func (m mockNodeMatcher) Matches(x interface{}) bool {
	n, ok := x.(*MockNode)
	if !ok {
		return false
	}
	return n == m.node
}

func (m mockNodeMatcher) String() string {
	return fmt.Sprintf("Matches node %v", m.node)
}

func checkStringSlices(t *testing.T, expected, got []string) {
	sort.Strings(expected)
	sort.Strings(got)
	if !reflect.DeepEqual(expected, got) {
		t.Errorf("Expected %v; got %v", expected, got)
	}
}

func TestFBStatusAllFields(t *testing.T) {
	mockCtrl, config, fbsk, nodeCache := fbStatusTestInit(t)
	defer fbStatusTestShutdown(mockCtrl, config)
	ctx := context.Background()

	// make a new root metadata
	id := tlf.FakeID(1, tlf.Private)
	h := parseTlfHandleOrBust(t, config, "alice", tlf.Private)
	u := h.FirstResolvedWriter()
	rmd, err := makeInitialRootMetadata(config.MetadataVersion(), id, h)
	require.NoError(t, err)
	rmd.SetUnmerged()
	rmd.SetLastModifyingWriter(u.AsUserOrBust())

	signingKey := kbfscrypto.MakeFakeSigningKeyOrBust("fake seed")
	signer := kbfscrypto.SigningKeySigner{Key: signingKey}
	err = rmd.bareMd.SignWriterMetadataInternally(
		ctx, kbfscodec.NewMsgpack(), signer)
	require.NoError(t, err)

	// make two nodes with expected PathFromNode calls
	n1 := newMockNode(mockCtrl)
	p1 := path{path: []pathNode{{Name: "a1"}, {Name: "b1"}}}
	nodeCache.EXPECT().PathFromNode(mockNodeMatcher{n1}).AnyTimes().Return(p1)
	n2 := newMockNode(mockCtrl)
	p2 := path{path: []pathNode{{Name: "a2"}, {Name: "b2"}}}
	nodeCache.EXPECT().PathFromNode(mockNodeMatcher{n2}).AnyTimes().Return(p2)

	fbsk.setRootMetadata(
		MakeImmutableRootMetadata(rmd, signingKey.GetVerifyingKey(),
			kbfsmd.FakeID(1), time.Now()))
	fbsk.addDirtyNode(n1)
	fbsk.addDirtyNode(n2)

	config.mockRekeyQueue.EXPECT().IsRekeyPending(id)

	// check the returned status for accuracy
	status, _, err := fbsk.getStatus(ctx, nil)
	if err != nil {
		t.Fatalf("Couldn't get status: %v", err)
	}

	if !status.Staged {
		t.Errorf("Status does not show staged changes")
	}
	if string(status.HeadWriter) != "alice" {
		t.Errorf("Unexpected head writer in status: %s", status.HeadWriter)
	}
	expectedDirtyPaths := []string{p1.String(), p2.String()}
	checkStringSlices(t, expectedDirtyPaths, status.DirtyPaths)
}
