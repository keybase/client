// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package service

import (
	"errors"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
	"golang.org/x/net/context"
)

type SimpleFSHandler struct {
	*BaseHandler
	libkb.Contextified
}

func NewSimpleFSHandler(xp rpc.Transporter, g *libkb.GlobalContext) *SimpleFSHandler {
	return &SimpleFSHandler{
		BaseHandler:  NewBaseHandler(xp),
		Contextified: libkb.NewContextified(g),
	}
}

func (s *SimpleFSHandler) client() (*keybase1.SimpleFSClient, error) {
	xp := s.G().ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, errors.New("KBFS client wasn't found")
	}
	return &keybase1.SimpleFSClient{
		Cli: rpc.NewClient(xp, libkb.ErrorUnwrapper{}),
	}, nil
}

// SimpleFSList - Begin list of items in directory at path
// Retrieve results with readList()
// Can be a single file to get flags/status
func (s *SimpleFSHandler) SimpleFSList(ctx context.Context, arg keybase1.SimpleFSListArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSList(ctx, arg)
}

// SimpleFSListRecursive - Begin recursive list of items in directory at path
func (s *SimpleFSHandler) SimpleFSListRecursive(ctx context.Context, arg keybase1.SimpleFSListRecursiveArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSListRecursive(ctx, arg)
}

// SimpleFSReadList - Get list of Paths in progress. Can indicate status of pending
// to get more entries.
func (s *SimpleFSHandler) SimpleFSReadList(ctx context.Context, arg keybase1.OpID) (keybase1.SimpleFSListResult, error) {
	cli, err := s.client()
	if err != nil {
		return keybase1.SimpleFSListResult{}, err
	}
	return cli.SimpleFSReadList(ctx, arg)
}

// SimpleFSCopy - Begin copy of file or directory
func (s *SimpleFSHandler) SimpleFSCopy(ctx context.Context, arg keybase1.SimpleFSCopyArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSCopy(ctx, arg)
}

// SimpleFSCopyRecursive - Begin recursive copy of directory
func (s *SimpleFSHandler) SimpleFSCopyRecursive(ctx context.Context, arg keybase1.SimpleFSCopyRecursiveArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSCopyRecursive(ctx, arg)
}

// SimpleFSMove - Begin move of file or directory, from/to KBFS only
func (s *SimpleFSHandler) SimpleFSMove(ctx context.Context, arg keybase1.SimpleFSMoveArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSMove(ctx, arg)
}

// SimpleFSRename - Rename file or directory, KBFS side only
func (s *SimpleFSHandler) SimpleFSRename(ctx context.Context, arg keybase1.SimpleFSRenameArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSRename(ctx, arg)
}

// SimpleFSOpen - Create/open a file and leave it open
// or create a directory
// Files must be closed afterwards.
func (s *SimpleFSHandler) SimpleFSOpen(ctx context.Context, arg keybase1.SimpleFSOpenArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSOpen(ctx, arg)
}

// SimpleFSSetStat - Set/clear file bits - only executable for now
func (s *SimpleFSHandler) SimpleFSSetStat(ctx context.Context, arg keybase1.SimpleFSSetStatArg) error {
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
	cli, err := s.client()
	if err != nil {
		return keybase1.FileContent{}, err
	}
	return cli.SimpleFSRead(ctx, arg)
}

// SimpleFSWrite - Append content to opened file.
// May be repeated until OpID is closed.
func (s *SimpleFSHandler) SimpleFSWrite(ctx context.Context, arg keybase1.SimpleFSWriteArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSWrite(ctx, arg)
}

// SimpleFSRemove - Remove file or directory from filesystem
func (s *SimpleFSHandler) SimpleFSRemove(ctx context.Context, arg keybase1.SimpleFSRemoveArg) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSRemove(ctx, arg)
}

// SimpleFSStat - Get info about file
func (s *SimpleFSHandler) SimpleFSStat(ctx context.Context, arg keybase1.Path) (keybase1.Dirent, error) {
	cli, err := s.client()
	if err != nil {
		return keybase1.Dirent{}, err
	}
	return cli.SimpleFSStat(ctx, arg)
}

// SimpleFSMakeOpid - Convenience helper for generating new random value
func (s *SimpleFSHandler) SimpleFSMakeOpid(ctx context.Context) (keybase1.OpID, error) {
	cli, err := s.client()
	if err != nil {
		return keybase1.OpID{}, err
	}
	return cli.SimpleFSMakeOpid(ctx)
}

// SimpleFSClose - Close OpID, cancels any pending operation.
// Must be called after list/copy/remove
func (s *SimpleFSHandler) SimpleFSClose(ctx context.Context, arg keybase1.OpID) error {
	cli, err := s.client()
	if err != nil {
		return err
	}
	return cli.SimpleFSClose(ctx, arg)
}

// SimpleFSCheck - Check progress of pending operation
func (s *SimpleFSHandler) SimpleFSCheck(ctx context.Context, arg keybase1.OpID) (keybase1.Progress, error) {
	cli, err := s.client()
	if err != nil {
		return 0, err
	}
	return cli.SimpleFSCheck(ctx, arg)
}

// SimpleFSGetOps - Get all the outstanding operations
func (s *SimpleFSHandler) SimpleFSGetOps(ctx context.Context) ([]keybase1.OpDescription, error) {
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
