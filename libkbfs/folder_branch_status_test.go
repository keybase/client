package libkbfs

import (
	"fmt"
	"testing"

	"github.com/golang/mock/gomock"
	"golang.org/x/net/context"
)

func fbStatusTestInit(t *testing.T) (*gomock.Controller, *ConfigMock,
	*folderBranchStatusKeeper, *MockNodeCache) {
	ctr := NewSafeTestReporter(t)
	mockCtrl := gomock.NewController(ctr)
	config := NewConfigMock(mockCtrl, ctr)
	nodeCache := NewMockNodeCache(mockCtrl)
	fbsk := newFolderBranchStatusKeeper(config, nodeCache)
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

	status, err := fbsk.getStatus(ctx)
	if err != nil {
		t.Fatalf("Couldn't get status: %v", err)
	}

	n := newMockNode(mockCtrl)
	p1 := path{path: []pathNode{pathNode{Name: "a1"}, pathNode{Name: "b1"}}}
	nodeCache.EXPECT().PathFromNode(mockNodeMatcher{n}).AnyTimes().Return(p1)

	fbsk.addDirtyNode(n)
	<-status.Changed()

	status, err = fbsk.getStatus(ctx)
	if err != nil {
		t.Fatalf("Couldn't get status: %v", err)
	}

	// no change should result in no signal
	fbsk.addDirtyNode(n)
	select {
	case <-status.Changed():
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

func TestFBStatusAllFields(t *testing.T) {
	mockCtrl, config, fbsk, nodeCache := fbStatusTestInit(t)
	defer fbStatusTestShutdown(mockCtrl, config)
	ctx := context.Background()

	// make a new root metadata
	u, id, h := makeID(t, config, false)
	md := NewRootMetadataForTest(h, id)
	md.Flags = MetadataFlagUnmerged
	md.data.LastWriter = u

	// make two nodes with expected PathFromNode calls
	n1 := newMockNode(mockCtrl)
	p1 := path{path: []pathNode{pathNode{Name: "a1"}, pathNode{Name: "b1"}}}
	nodeCache.EXPECT().PathFromNode(mockNodeMatcher{n1}).AnyTimes().Return(p1)
	n2 := newMockNode(mockCtrl)
	p2 := path{path: []pathNode{pathNode{Name: "a2"}, pathNode{Name: "b2"}}}
	nodeCache.EXPECT().PathFromNode(mockNodeMatcher{n2}).AnyTimes().Return(p2)

	fbsk.setRootMetadata(md)
	fbsk.addDirtyNode(n1)
	fbsk.addDirtyNode(n2)
	fbsk.addDownloadingNode(n1)
	fbsk.addUploadingNode(n2)

	// check the returned status for accuracy
	status, err := fbsk.getStatus(ctx)
	if err != nil {
		t.Fatalf("Couldn't get status: %v", err)
	}

	if !status.Staged {
		t.Errorf("Status does not show staged changes")
	}
	if status.HeadWriter != fmt.Sprintf("user_%s", h.Writers[0]) {
		t.Errorf("Unexpected head writer in status: %s", status.HeadWriter)
	}
	if len(status.DirtyPaths) != 2 {
		t.Errorf("Expected 2 dirty paths in status, got %d",
			len(status.DirtyPaths))
	}
	p1Str := p1.String()
	p2Str := p2.String()
	var p1Found, p2Found bool
	for _, p := range status.DirtyPaths {
		if p == p1Str {
			p1Found = true
		}
		if p == p2Str {
			p2Found = true
		}
	}
	if !p1Found || !p2Found {
		t.Errorf("Did not find all dirty nodes: %v", status.DirtyPaths)
	}
	if len(status.DownloadingPaths) != 1 {
		t.Errorf("Expected 1 dirty path in status, got %d",
			len(status.DownloadingPaths))
	}
	if status.DownloadingPaths[0] != p1Str {
		t.Errorf("Downloading path wrong: %s", status.DownloadingPaths[1])
	}
	if len(status.UploadingPaths) != 1 {
		t.Errorf("Expected 1 dirty path in status, got %d",
			len(status.UploadingPaths))
	}
	if status.UploadingPaths[0] != p2Str {
		t.Errorf("Uploading path wrong: %s", status.UploadingPaths[0])
	}
}
