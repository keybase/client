package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/libkbfs"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

var mdGetRegexp = regexp.MustCompile("^(.+?)(?::(.*?))?(?:\\^(.*?))?$")

func parseTLFPath(ctx context.Context, kbpki libkbfs.KBPKI, tlfStr string) (
	*libkbfs.TlfHandle, error) {
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
	return fsrpc.ParseTlfHandle(ctx, kbpki, p.TLFName, p.TLFType)
}

func getTlfID(
	ctx context.Context, config libkbfs.Config, tlfStr string) (
	tlf.ID, error) {
	tlfID, err := tlf.ParseID(tlfStr)
	if err == nil {
		return tlfID, nil
	}

	handle, err := parseTLFPath(ctx, config.KBPKI(), tlfStr)
	if err != nil {
		return tlf.ID{}, err
	}

	_, irmd, err := config.MDOps().GetForHandle(ctx, handle, libkbfs.Merged)
	if err != nil {
		return tlf.ID{}, err
	}

	if irmd == (libkbfs.ImmutableRootMetadata{}) {
		return tlf.ID{}, fmt.Errorf(
			"Could not get TLF ID for %q", tlfStr)
	}

	return irmd.TlfID(), nil
}

func getBranchID(ctx context.Context, config libkbfs.Config,
	tlfID tlf.ID, branchStr string) (libkbfs.BranchID, error) {
	if branchStr == "master" {
		return libkbfs.NullBranchID, nil
	}

	if len(branchStr) == 0 || branchStr == "device" {
		irmd, err := config.MDOps().GetUnmergedForTLF(
			ctx, tlfID, libkbfs.NullBranchID)
		if err != nil {
			return libkbfs.NullBranchID, err
		}
		if irmd == (libkbfs.ImmutableRootMetadata{}) {
			return libkbfs.NullBranchID, nil
		}
		return irmd.BID(), nil
	}

	return libkbfs.ParseBranchID(branchStr)
}

func getRevision(ctx context.Context, config libkbfs.Config,
	tlfID tlf.ID, branchID libkbfs.BranchID,
	revisionStr string) (kbfsmd.Revision, error) {
	if len(revisionStr) == 0 || revisionStr == "latest" {
		if branchID == libkbfs.NullBranchID {
			irmd, err := config.MDOps().GetForTLF(ctx, tlfID)
			if err != nil {
				return kbfsmd.RevisionUninitialized,
					err
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

func mdGet(ctx context.Context, config libkbfs.Config, tlfID tlf.ID,
	branchID libkbfs.BranchID, rev kbfsmd.Revision) (
	libkbfs.ImmutableRootMetadata, error) {
	var irmds []libkbfs.ImmutableRootMetadata
	var err error
	if branchID == libkbfs.NullBranchID {
		irmds, err = config.MDOps().GetRange(ctx, tlfID, rev, rev)
		if err != nil {
			return libkbfs.ImmutableRootMetadata{}, err
		}
	} else {
		irmds, err = config.MDOps().GetUnmergedRange(
			ctx, tlfID, branchID, rev, rev)
		if err != nil {
			return libkbfs.ImmutableRootMetadata{}, err
		}
	}

	if len(irmds) >= 1 {
		return irmds[0], nil
	}

	return libkbfs.ImmutableRootMetadata{}, nil
}

func mdParseAndGet(ctx context.Context, config libkbfs.Config, input string) (
	libkbfs.ImmutableRootMetadata, error) {
	matches := mdGetRegexp.FindStringSubmatch(input)
	if matches == nil {
		return libkbfs.ImmutableRootMetadata{},
			fmt.Errorf("Could not parse %q", input)
	}

	tlfStr := matches[1]
	branchStr := matches[2]
	revisionStr := matches[3]

	tlfID, err := getTlfID(ctx, config, tlfStr)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}

	branchID, err := getBranchID(ctx, config, tlfID, branchStr)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}

	rev, err := getRevision(ctx, config, tlfID, branchID, revisionStr)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, err
	}

	return mdGet(ctx, config, tlfID, branchID, rev)
}

func mdGetMergedHeadForWriter(ctx context.Context, config libkbfs.Config,
	tlfPath string) (libkbfs.ImmutableRootMetadata, keybase1.UID, error) {
	handle, err := parseTLFPath(ctx, config.KBPKI(), tlfPath)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, keybase1.UID(""), err
	}

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, keybase1.UID(""), err
	}

	// Make sure we're a writer before doing anything else.
	if !handle.IsWriter(session.UID) {
		return libkbfs.ImmutableRootMetadata{}, keybase1.UID(""),
			libkbfs.NewWriteAccessError(
				handle, session.Name, handle.GetCanonicalPath())
	}

	fmt.Printf("Looking for unmerged branch...\n")

	_, unmergedIRMD, err := config.MDOps().GetForHandle(
		ctx, handle, libkbfs.Unmerged)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, keybase1.UID(""), err
	}
	if unmergedIRMD != (libkbfs.ImmutableRootMetadata{}) {
		return libkbfs.ImmutableRootMetadata{}, keybase1.UID(""), fmt.Errorf(
			"%s has unmerged data; try unstaging it first",
			tlfPath)
	}

	fmt.Printf("Getting latest metadata...\n")

	_, irmd, err := config.MDOps().GetForHandle(
		ctx, handle, libkbfs.Merged)
	if err != nil {
		return libkbfs.ImmutableRootMetadata{}, keybase1.UID(""), err
	}

	if irmd == (libkbfs.ImmutableRootMetadata{}) {
		fmt.Printf("No TLF found for %q\n", tlfPath)
		return libkbfs.ImmutableRootMetadata{}, keybase1.UID(""), nil
	}

	return irmd, session.UID, nil
}
