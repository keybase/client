package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/keybase/client/go/kbfs/fsrpc"
	"github.com/keybase/client/go/kbfs/idutil"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

var mdInputRegexp = regexp.MustCompile(
	`^(.+?)(?::(.*?))?(?:\^(.*?)(?:-(.*?))?)?$`)

func mdSplitInput(input string) (
	tlfStr, branchStr, startStr, stopStr string, err error) {
	matches := mdInputRegexp.FindStringSubmatch(input)
	if matches == nil {
		return "", "", "", "", fmt.Errorf("Could not parse %q", input)
	}

	return matches[1], matches[2], matches[3], matches[4], nil
}

func mdJoinInput(tlfStr, branchStr, startStr, stopStr string) string {
	s := tlfStr
	if branchStr != "" {
		s += ":" + branchStr
	}
	if startStr != "" || stopStr != "" {
		s += "^" + startStr
		if stopStr != "" {
			s += "-" + stopStr
		}
	}
	return s
}

func mdParseInput(ctx context.Context, config libkbfs.Config,
	tlfStr, branchStr, startStr, stopStr string) (
	tlfID tlf.ID, branchID kbfsmd.BranchID, start, stop kbfsmd.Revision, err error) {
	tlfID, err = getTlfID(ctx, config, tlfStr)
	if err != nil {
		return tlf.ID{}, kbfsmd.BranchID{}, kbfsmd.RevisionUninitialized,
			kbfsmd.RevisionUninitialized, err
	}

	branchID, err = getBranchID(ctx, config, tlfID, branchStr)
	if err != nil {
		return tlf.ID{}, kbfsmd.BranchID{}, kbfsmd.RevisionUninitialized,
			kbfsmd.RevisionUninitialized, err
	}

	start, err = getRevision(ctx, config, tlfID, branchID, startStr)
	if err != nil {
		return tlf.ID{}, kbfsmd.BranchID{}, kbfsmd.RevisionUninitialized,
			kbfsmd.RevisionUninitialized, err
	}

	// TODO: Chunk the range between start and stop.

	stop = start
	if stopStr != "" {
		stop, err = getRevision(ctx, config, tlfID, branchID, stopStr)
		if err != nil {
			return tlf.ID{}, kbfsmd.BranchID{}, kbfsmd.RevisionUninitialized,
				kbfsmd.RevisionUninitialized, err
		}
	}

	return tlfID, branchID, start, stop, nil
}

func parseTLFPath(ctx context.Context, kbpki libkbfs.KBPKI,
	mdOps libkbfs.MDOps, osg idutil.OfflineStatusGetter, tlfStr string) (
	*tlfhandle.Handle, error) {
	p, err := fsrpc.NewPath(tlfStr)
	if err != nil {
		return nil, err
	}
	if p.PathType != fsrpc.TLFPathType {
		return nil, fmt.Errorf("%q is not a TLF path", tlfStr)
	}
	if len(p.TLFComponents) > 0 {
		return nil, fmt.Errorf(
			"%q is not the root path of a TLF", tlfStr)
	}
	return fsrpc.ParseTlfHandle(ctx, kbpki, mdOps, osg, p.TLFName, p.TLFType)
}

func getTlfID(
	ctx context.Context, config libkbfs.Config, tlfStr string) (
	tlf.ID, error) {
	_, err := kbfsmd.ParseID(tlfStr)
	if err == nil {
		return tlf.ID{}, errors.New("Cannot handle metadata IDs")
	}

	tlfID, err := tlf.ParseID(tlfStr)
	if err == nil {
		return tlfID, nil
	} else if _, ok := errors.Cause(err).(tlf.InvalidIDError); !ok {
		return tlf.ID{}, err
	}

	handle, err := parseTLFPath(
		ctx, config.KBPKI(), config.MDOps(), config, tlfStr)
	if err != nil {
		return tlf.ID{}, err
	}

	return config.MDOps().GetIDForHandle(ctx, handle)
}

func getBranchID(ctx context.Context, config libkbfs.Config,
	tlfID tlf.ID, branchStr string) (kbfsmd.BranchID, error) {
	if branchStr == "master" {
		return kbfsmd.NullBranchID, nil
	}

	if len(branchStr) == 0 || branchStr == "device" {
		irmd, err := config.MDOps().GetUnmergedForTLF(
			ctx, tlfID, kbfsmd.NullBranchID)
		if err != nil {
			return kbfsmd.NullBranchID, err
		}
		if irmd == (libkbfs.ImmutableRootMetadata{}) {
			return kbfsmd.NullBranchID, nil
		}
		return irmd.BID(), nil
	}

	return kbfsmd.ParseBranchID(branchStr)
}

func getRevision(ctx context.Context, config libkbfs.Config,
	tlfID tlf.ID, branchID kbfsmd.BranchID,
	revisionStr string) (kbfsmd.Revision, error) {
	if len(revisionStr) == 0 || revisionStr == "latest" {
		if branchID == kbfsmd.NullBranchID {
			irmd, err := config.MDOps().GetForTLF(ctx, tlfID, nil)
			if err != nil {
				return kbfsmd.RevisionUninitialized, err
			}
			return irmd.Revision(), nil
		}

		irmd, err := config.MDOps().GetUnmergedForTLF(
			ctx, tlfID, branchID)
		if err != nil {
			return kbfsmd.RevisionUninitialized, err
		}
		return irmd.Revision(), nil
	}

	base := 10
	if strings.HasPrefix(revisionStr, "0x") {
		base = 16
		revisionStr = strings.TrimPrefix(revisionStr, "0x")
	}
	u, err := strconv.ParseUint(revisionStr, base, 64)
	if err != nil {
		return kbfsmd.RevisionUninitialized, err
	}
	return kbfsmd.Revision(u), nil
}

func reverseIRMDList(irmds []libkbfs.ImmutableRootMetadata) []libkbfs.ImmutableRootMetadata {
	irmdsReversed := make([]libkbfs.ImmutableRootMetadata, len(irmds))
	for i := range irmds {
		irmdsReversed[i] = irmds[len(irmds)-1-i]
	}
	return irmdsReversed
}

func mdGet(ctx context.Context, config libkbfs.Config, tlfID tlf.ID,
	branchID kbfsmd.BranchID, start, stop kbfsmd.Revision) (
	irmds []libkbfs.ImmutableRootMetadata, err error) {
	if start > stop {
		panic("start unexpectedly greater than stop")
	}

	if branchID == kbfsmd.NullBranchID {
		irmds, err = config.MDOps().GetRange(ctx, tlfID, start, stop, nil)
	} else {
		irmds, err = config.MDOps().GetUnmergedRange(
			ctx, tlfID, branchID, start, stop)
	}
	if err != nil {
		return nil, err
	}

	var latestIRMD libkbfs.ImmutableRootMetadata
	var uid keybase1.UID
	for i, irmd := range irmds {
		if !irmd.IsReadable() {
			if latestIRMD == (libkbfs.ImmutableRootMetadata{}) {
				if branchID == kbfsmd.NullBranchID {
					latestIRMD, err = config.MDOps().GetForTLF(ctx, tlfID, nil)
				} else {
					latestIRMD, err = config.MDOps().GetUnmergedForTLF(ctx, tlfID, branchID)
				}
				if err != nil {
					return nil, err
				}
			}

			if uid == keybase1.UID("") {
				session, err := config.KBPKI().GetCurrentSession(ctx)
				if err != nil {
					return nil, err
				}
				uid = session.UID
			}

			irmdCopy, err := libkbfs.MakeCopyWithDecryptedPrivateData(
				ctx, config, irmd, latestIRMD, uid)
			if err != nil {
				return nil, err
			}
			irmds[i] = irmdCopy
		}
	}

	return irmds, nil
}

func mdGetMergedHeadForWriter(ctx context.Context, config libkbfs.Config,
	tlfPath string) (libkbfs.ImmutableRootMetadata, error) {
	handle, err := parseTLFPath(
		ctx, config.KBPKI(), config.MDOps(), config, tlfPath)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}

	// Make sure we're a writer before doing anything else.
	isWriter, err := libkbfs.IsWriterFromHandle(
		ctx, handle, config.KBPKI(), config, session.UID, session.VerifyingKey)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}
	if !isWriter {
		return libkbfs.ImmutableRootMetadata{},
			tlfhandle.NewWriteAccessError(
				handle, session.Name, handle.GetCanonicalPath())
	}

	fmt.Printf("Looking for unmerged branch...\n")

	tlfID, err := config.MDOps().GetIDForHandle(ctx, handle)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}
	if tlfID == tlf.NullID {
		return libkbfs.ImmutableRootMetadata{}, errors.New("No TLF ID")
	}

	unmergedIRMD, err := config.MDOps().GetUnmergedForTLF(
		ctx, tlfID, kbfsmd.NullBranchID)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}

	if unmergedIRMD != (libkbfs.ImmutableRootMetadata{}) {
		return libkbfs.ImmutableRootMetadata{}, fmt.Errorf(
			"%s has unmerged data; try unstaging it first",
			tlfPath)
	}

	fmt.Printf("Getting latest metadata...\n")

	irmd, err := config.MDOps().GetForTLF(ctx, tlfID, nil)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}

	if irmd == (libkbfs.ImmutableRootMetadata{}) {
		fmt.Printf("No TLF found for %q\n", tlfPath)
		return libkbfs.ImmutableRootMetadata{}, nil
	}

	return irmd, nil
}
