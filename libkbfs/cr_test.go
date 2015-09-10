package libkbfs

import (
	"testing"

	"github.com/golang/mock/gomock"
	"golang.org/x/net/context"
)

func crTestInit(t *testing.T) (mockCtrl *gomock.Controller, config *ConfigMock,
	cr *ConflictResolver) {
	ctr := NewSafeTestReporter(t)
	mockCtrl = gomock.NewController(ctr)
	config = NewConfigMock(mockCtrl, ctr)
	id, _, _ := NewFolder(t, 1, 1, false, false)
	fbo := NewFolderBranchOps(config, FolderBranch{id, MasterBranch}, standard)
	cr = NewConflictResolver(config, fbo)
	return mockCtrl, config, cr
}

func crTestShutdown(mockCtrl *gomock.Controller, config *ConfigMock,
	cr *ConflictResolver) {
	config.ctr.CheckForFailures()
	cr.fbo.Shutdown()
	mockCtrl.Finish()
}

func TestCRInput(t *testing.T) {
	mockCtrl, config, cr := crTestInit(t)
	defer crTestShutdown(mockCtrl, config, cr)
	ctx := context.Background()

	// First try a completely unknown revision
	cr.Resolve(MetadataRevisionUninitialized, MetadataRevisionUninitialized)
	// This should return without doing anything (i.e., without
	// calling any mock methods)
	cr.Wait(ctx)

	// Next, try resolving a few items
	branchPoint := MetadataRevision(2)
	unmergedHead := MetadataRevision(5)
	mergedHead := MetadataRevision(15)

	cr.fbo.head = &RootMetadata{
		Revision: unmergedHead,
		Flags:    MetadataFlagUnmerged,
	}
	// serve all the MDs from the cache
	for i := unmergedHead; i >= branchPoint+1; i-- {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, false).Return(
			&RootMetadata{
				Revision: i,
				Flags:    MetadataFlagUnmerged,
			}, nil)
	}
	config.mockMdcache.EXPECT().Get(cr.fbo.id(), branchPoint, false).Return(
		nil, NoSuchMDError{cr.fbo.id(), branchPoint, false})
	config.mockMdops.EXPECT().GetUnmergedRange(gomock.Any(), cr.fbo.id(),
		MetadataRevisionInitial, branchPoint).Return(nil, nil)

	for i := branchPoint + 1; i <= mergedHead; i++ {
		config.mockMdcache.EXPECT().Get(cr.fbo.id(), i, true).Return(
			&RootMetadata{Revision: i}, nil)
	}
	config.mockMdcache.EXPECT().Get(cr.fbo.id(), mergedHead+1, true).Return(
		nil, NoSuchMDError{cr.fbo.id(), mergedHead + 1, false})
	config.mockMdops.EXPECT().GetRange(gomock.Any(), cr.fbo.id(),
		mergedHead+1, gomock.Any()).Return(nil, nil)

	// First try a completely unknown revision
	cr.Resolve(unmergedHead, MetadataRevisionUninitialized)
	cr.Wait(ctx)
	// Make sure sure the input is up-to-date
	if cr.currInput.merged != mergedHead {
		t.Fatalf("Unexpected merged input: %d\n", cr.currInput.merged)
	}

	// Now make sure we ignore future inputs with lesser MDs
	cr.Resolve(MetadataRevisionUninitialized, mergedHead-1)
	// This should return without doing anything (i.e., without
	// calling any mock methods)
	cr.Wait(ctx)
}
