// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"time"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

// Fast operations like Stat usually finish fairly quickly. Slow
// operations in SimpleFS are handled in an async manner, where the RPC starts
// the operation but does not wait for it to finish (there's SimpleFSWait). So
// it probably seems like this is too long a timeout since all RPCs except for
// SimpleFSWait should return fairly fast. However, when user first navigates
// into a TLF, it might still take much longer, especially on a slow network.
// So just cap it at 1 minute.
const simpleFSTimeout = 1 * time.Minute

type SimpleFSHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewSimpleFSHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SimpleFSHandler {
	return &SimpleFSHandler{
		BaseHandler:  NewBaseHandler(g, xp),
		Contextified: libkb.NewContextified(g),
	}
}

var _ keybase1.SimpleFSInterface = (*SimpleFSHandler)(nil)

func (s *SimpleFSHandler) wrapContextWithTimeout(ctx context.Context) (newCtx context.Context, cancel func()) {
	return context.WithTimeout(ctx, simpleFSTimeout)
}

func (s *SimpleFSHandler) client() (*keybase1.SimpleFSClient, error) {
	xp := s.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, libkb.KBFSNotRunningError{}
	}
	return &keybase1.SimpleFSClient{
		Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(s.G()), nil),
	}, nil
}

// SimpleFSList - Begin list of items in directory at path
// Retrieve results with readList()
// Can be a single file to get flags/status
func (s *SimpleFSHandler) SimpleFSList(ctx context.Context, arg keybase1.SimpleFSListArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSList(ctx, arg)
}

// SimpleFSListRecursive - Begin recursive list of items in directory at path
func (s *SimpleFSHandler) SimpleFSListRecursive(ctx context.Context, arg keybase1.SimpleFSListRecursiveArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSListRecursive(ctx, arg)
}

// SimpleFSFolderSetSyncConfig implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSListFavorites(ctx context.Context) (
	keybase1.FavoritesResult, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.FavoritesResult{}, err
	}
	return cli.SimpleFSListFavorites(ctx)
}

// SimpleFSListRecursiveToDepth - Begin recursive list of items in directory at
// path to a given depth.
func (s *SimpleFSHandler) SimpleFSListRecursiveToDepth(ctx context.Context, arg keybase1.SimpleFSListRecursiveToDepthArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSListRecursiveToDepth(ctx, arg)
}

// SimpleFSReadList - Get list of Paths in progress. Can indicate status of pending
// to get more entries.
func (s *SimpleFSHandler) SimpleFSReadList(ctx context.Context, arg keybase1.OpID) (keybase1.SimpleFSListResult, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.SimpleFSListResult{}, err
	}
	return cli.SimpleFSReadList(ctx, arg)
}

// SimpleFSCopy - Begin copy of file or directory
func (s *SimpleFSHandler) SimpleFSCopy(ctx context.Context, arg keybase1.SimpleFSCopyArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSCopy(ctx, arg)
}

// SimpleFSCopyRecursive - Begin recursive copy of directory
func (s *SimpleFSHandler) SimpleFSCopyRecursive(ctx context.Context, arg keybase1.SimpleFSCopyRecursiveArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSCopyRecursive(ctx, arg)
}

// SimpleFSMove - Begin move of file or directory, from/to KBFS only
func (s *SimpleFSHandler) SimpleFSMove(ctx context.Context, arg keybase1.SimpleFSMoveArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSMove(ctx, arg)
}

// SimpleFSRename - Rename file or directory, KBFS side only
func (s *SimpleFSHandler) SimpleFSRename(ctx context.Context, arg keybase1.SimpleFSRenameArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSRename(ctx, arg)
}

// SimpleFSSymlink - Make a symlink from KBFS to either elsewhere in KBFS or in the regular filesystem
func (s *SimpleFSHandler) SimpleFSSymlink(ctx context.Context, arg keybase1.SimpleFSSymlinkArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSSymlink(ctx, arg)
}

// SimpleFSOpen - Create/open a file and leave it open
// or create a directory
// Files must be closed afterwards.
func (s *SimpleFSHandler) SimpleFSOpen(ctx context.Context, arg keybase1.SimpleFSOpenArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSOpen(ctx, arg)
}

// SimpleFSSetStat - Set/clear file bits - only executable for now
func (s *SimpleFSHandler) SimpleFSSetStat(ctx context.Context, arg keybase1.SimpleFSSetStatArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSSetStat(ctx, arg)
}

// SimpleFSRead - Read (possibly partial) contents of open file,
// up to the amount specified by size.
// Repeat until zero bytes are returned or error.
// If size is zero, read an arbitrary amount.
func (s *SimpleFSHandler) SimpleFSRead(ctx context.Context, arg keybase1.SimpleFSReadArg) (keybase1.FileContent, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.FileContent{}, err
	}
	return cli.SimpleFSRead(ctx, arg)
}

// SimpleFSWrite - Append content to opened file.
// May be repeated until OpID is closed.
func (s *SimpleFSHandler) SimpleFSWrite(ctx context.Context, arg keybase1.SimpleFSWriteArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSWrite(ctx, arg)
}

// SimpleFSRemove - Remove file or directory from filesystem
func (s *SimpleFSHandler) SimpleFSRemove(ctx context.Context, arg keybase1.SimpleFSRemoveArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSRemove(ctx, arg)
}

// SimpleFSStat - Get info about file
func (s *SimpleFSHandler) SimpleFSStat(ctx context.Context, arg keybase1.SimpleFSStatArg) (keybase1.Dirent, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.Dirent{}, err
	}
	return cli.SimpleFSStat(ctx, arg)
}

// SimpleFSGetRevisions - Get revision info for a directory entry
func (s *SimpleFSHandler) SimpleFSGetRevisions(
	ctx context.Context, arg keybase1.SimpleFSGetRevisionsArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSGetRevisions(ctx, arg)
}

// SimpleFSReadRevisions - Get list of revisions in progress. Can
// indicate status of pending to get more entries.
func (s *SimpleFSHandler) SimpleFSReadRevisions(
	ctx context.Context, opID keybase1.OpID) (
	keybase1.GetRevisionsResult, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.GetRevisionsResult{}, err
	}
	return cli.SimpleFSReadRevisions(ctx, opID)
}

// SimpleFSMakeOpid - Convenience helper for generating new random value
func (s *SimpleFSHandler) SimpleFSMakeOpid(ctx context.Context) (keybase1.OpID, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.OpID{}, err
	}
	return cli.SimpleFSMakeOpid(ctx)
}

// SimpleFSClose - Close OpID, cancels any pending operation.
// Must be called after list/copy/remove
func (s *SimpleFSHandler) SimpleFSClose(ctx context.Context, arg keybase1.OpID) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSClose(ctx, arg)
}

// SimpleFSCancel - Cancels a running operation, like copy.
func (s *SimpleFSHandler) SimpleFSCancel(ctx context.Context, arg keybase1.OpID) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSCancel(ctx, arg)
}

// SimpleFSCheck - Check progress of pending operation
func (s *SimpleFSHandler) SimpleFSCheck(ctx context.Context, arg keybase1.OpID) (keybase1.OpProgress, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.OpProgress{}, err
	}
	return cli.SimpleFSCheck(ctx, arg)
}

// SimpleFSGetOps - Get all the outstanding operations
func (s *SimpleFSHandler) SimpleFSGetOps(ctx context.Context) ([]keybase1.OpDescription, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return []keybase1.OpDescription{}, err
	}
	return cli.SimpleFSGetOps(ctx)
}

// SimpleFSWait - Blocking wait for the pending operation to finish
func (s *SimpleFSHandler) SimpleFSWait(ctx context.Context, arg keybase1.OpID) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSWait(ctx, arg)
}

// SimpleFSDumpDebuggingInfo - Instructs KBFS to dump debugging info
// into its logs.
func (s *SimpleFSHandler) SimpleFSDumpDebuggingInfo(ctx context.Context) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSDumpDebuggingInfo(ctx)
}

// SimpleFSSyncStatus - Get sync status.
func (s *SimpleFSHandler) SimpleFSSyncStatus(ctx context.Context, filter keybase1.ListFilter) (keybase1.FSSyncStatus, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.FSSyncStatus{}, err
	}
	return cli.SimpleFSSyncStatus(ctx, filter)
}

// SimpleFSUserEditHistory implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSUserEditHistory(ctx context.Context) (
	res []keybase1.FSFolderEditHistory, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return nil, err
	}
	return cli.SimpleFSUserEditHistory(ctx)
}

// SimpleFSFolderEditHistory implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSFolderEditHistory(
	ctx context.Context, path keybase1.Path) (
	res keybase1.FSFolderEditHistory, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.FSFolderEditHistory{}, err
	}
	return cli.SimpleFSFolderEditHistory(ctx, path)
}

// SimpleFSReset implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSReset(
	ctx context.Context, arg keybase1.SimpleFSResetArg) (err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSReset(ctx, arg)
}

// SimpleFSGetUserQuotaUsage implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSGetUserQuotaUsage(ctx context.Context) (
	keybase1.SimpleFSQuotaUsage, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.SimpleFSQuotaUsage{}, err
	}
	return cli.SimpleFSGetUserQuotaUsage(ctx)
}

// SimpleFSGetTeamQuotaUsage implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSGetTeamQuotaUsage(
	ctx context.Context, teamName keybase1.TeamName) (
	keybase1.SimpleFSQuotaUsage, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.SimpleFSQuotaUsage{}, err
	}
	return cli.SimpleFSGetTeamQuotaUsage(ctx, teamName)
}

// SimpleFSGetFolder implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSGetFolder(
	ctx context.Context, kbfsPath keybase1.KBFSPath) (
	res keybase1.FolderWithFavFlags, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.FolderWithFavFlags{}, err
	}
	return cli.SimpleFSGetFolder(ctx, kbfsPath)
}

// SimpleFSFolderSyncConfigAndStatus implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSFolderSyncConfigAndStatus(
	ctx context.Context, path keybase1.Path) (
	keybase1.FolderSyncConfigAndStatus, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.FolderSyncConfigAndStatus{}, err
	}
	return cli.SimpleFSFolderSyncConfigAndStatus(ctx, path)
}

// SimpleFSFolderSetSyncConfig implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSSetFolderSyncConfig(
	ctx context.Context, arg keybase1.SimpleFSSetFolderSyncConfigArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSSetFolderSyncConfig(ctx, arg)
}

// SimpleFSSyncConfigAndStatus implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSSyncConfigAndStatus(
	ctx context.Context, identifyBehavior *keybase1.TLFIdentifyBehavior) (keybase1.SyncConfigAndStatusRes, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.SyncConfigAndStatusRes{}, err
	}
	return cli.SimpleFSSyncConfigAndStatus(ctx, identifyBehavior)
}

// SimpleFSClearConflictState implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSClearConflictState(ctx context.Context,
	path keybase1.Path) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSClearConflictState(ctx, path)
}

// SimpleFSFinishResolvingConflict implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSFinishResolvingConflict(ctx context.Context,
	path keybase1.Path) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSFinishResolvingConflict(ctx, path)
}

// SimpleFSForceStuckConflict implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSForceStuckConflict(
	ctx context.Context, path keybase1.Path) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSForceStuckConflict(ctx, path)
}

// SimpleFSAreWeConnectedToMDServer implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSAreWeConnectedToMDServer(
	ctx context.Context) (bool, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return false, err
	}
	return cli.SimpleFSAreWeConnectedToMDServer(ctx)
}

// SimpleFSCheckReachability implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSCheckReachability(ctx context.Context) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSCheckReachability(ctx)
}

// SimpleFSSetDebugLevel implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSSetDebugLevel(
	ctx context.Context, level string) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSSetDebugLevel(ctx, level)
}

// SimpleFSSettings implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSSettings(
	ctx context.Context) (keybase1.FSSettings, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.FSSettings{}, err
	}
	return cli.SimpleFSSettings(ctx)
}

// SimpleFSSetNotificationThreshold implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSSetNotificationThreshold(
	ctx context.Context, threshold int64) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSSetNotificationThreshold(ctx, threshold)
}

// SimpleFSObfuscatePath implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSObfuscatePath(
	ctx context.Context, path keybase1.Path) (res string, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return "", err
	}
	return cli.SimpleFSObfuscatePath(ctx, path)
}

// SimpleFSDeobfuscatePath implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSDeobfuscatePath(
	ctx context.Context, path keybase1.Path) (res []string, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return nil, err
	}
	return cli.SimpleFSDeobfuscatePath(ctx, path)
}

// SimpleFSGetStats implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSGetStats(ctx context.Context) (
	keybase1.SimpleFSStats, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.SimpleFSStats{}, err
	}
	return cli.SimpleFSGetStats(ctx)
}

func (s *SimpleFSHandler) SimpleFSSubscribeNonPath(ctx context.Context, arg keybase1.SimpleFSSubscribeNonPathArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSSubscribeNonPath(ctx, arg)
}

func (s *SimpleFSHandler) SimpleFSSubscribePath(ctx context.Context, arg keybase1.SimpleFSSubscribePathArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSSubscribePath(ctx, arg)
}

func (s *SimpleFSHandler) SimpleFSUnsubscribe(ctx context.Context, arg keybase1.SimpleFSUnsubscribeArg) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSUnsubscribe(ctx, arg)
}

func (s *SimpleFSHandler) SimpleFSStartDownload(
	ctx context.Context, arg keybase1.SimpleFSStartDownloadArg) (downloadID string, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return "", err
	}
	return cli.SimpleFSStartDownload(ctx, arg)
}

func (s *SimpleFSHandler) SimpleFSGetDownloadStatus(ctx context.Context) (
	status keybase1.DownloadStatus, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.DownloadStatus{}, err
	}
	return cli.SimpleFSGetDownloadStatus(ctx)
}

func (s *SimpleFSHandler) SimpleFSCancelDownload(
	ctx context.Context, downloadID string) (err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSCancelDownload(ctx, downloadID)
}

func (s *SimpleFSHandler) SimpleFSDismissDownload(
	ctx context.Context, downloadID string) (err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSDismissDownload(ctx, downloadID)
}

func (s *SimpleFSHandler) SimpleFSGetDownloadInfo(
	ctx context.Context, downloadID string) (downloadInfo keybase1.DownloadInfo, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.DownloadInfo{}, err
	}
	return cli.SimpleFSGetDownloadInfo(ctx, downloadID)
}

func (s *SimpleFSHandler) SimpleFSConfigureDownload(
	ctx context.Context, arg keybase1.SimpleFSConfigureDownloadArg) (err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSConfigureDownload(ctx, arg)
}

// SimpleFSGetGUIFileContext implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSGetGUIFileContext(ctx context.Context,
	path keybase1.KBFSPath) (resource keybase1.GUIFileContext, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.GUIFileContext{}, err
	}
	return cli.SimpleFSGetGUIFileContext(ctx, path)
}

// SimpleFSGetFilesTabBadge implements the SimpleFSInterface.
func (s *SimpleFSHandler) SimpleFSGetFilesTabBadge(ctx context.Context) (
	keybase1.FilesTabBadge, error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return keybase1.FilesTabBadge_NONE, err
	}
	return cli.SimpleFSGetFilesTabBadge(ctx)
}

func (s *SimpleFSHandler) SimpleFSDoIndex(
	ctx context.Context, path keybase1.Path) error {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSDoIndex(ctx, path)
}

func (s *SimpleFSHandler) SimpleFSSearch(
	ctx context.Context, query string) (res []string, err error) {
	ctx, cancel := s.wrapContextWithTimeout(ctx)
	defer cancel()
	cli, err := s.client()
	if err != nil {
		return nil, err
	}
	return cli.SimpleFSSearch(ctx, query)
}
