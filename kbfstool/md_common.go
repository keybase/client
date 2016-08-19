package main

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

var mdGetRegexp = regexp.MustCompile("^(.+?)(?::(.*?))?(?:\\^(.*?))?$")

func getTlfID(
	ctx context.Context, config libkbfs.Config, tlfStr string) (
	libkbfs.TlfID, error) {
	tlfID, err := libkbfs.ParseTlfID(tlfStr)
	if err == nil {
		return tlfID, nil
	}

	var handle *libkbfs.TlfHandle
	p, err := fsrpc.NewPath(tlfStr)
	if err != nil {
		return libkbfs.TlfID{}, err
	}
	if p.PathType != fsrpc.TLFPathType {
		return libkbfs.TlfID{}, fmt.Errorf(
			"%q is not a TLF path", tlfStr)
	}
	if len(p.TLFComponents) > 0 {
		return libkbfs.TlfID{}, fmt.Errorf(
			"%q is not the root path of a TLF", tlfStr)
	}
	name := p.TLFName
outer:
	for {
		var err error
		handle, err = libkbfs.ParseTlfHandle(
			ctx, config.KBPKI(), name, p.Public)
		switch err := err.(type) {
		case nil:
			// No error.
			break outer

		case libkbfs.TlfNameNotCanonical:
			// Non-canonical name, so try again.
			name = err.NameToTry

		default:
			// Some other error.
			return libkbfs.TlfID{}, err
		}
	}

	_, irmd, err := config.MDOps().GetForHandle(ctx, handle, libkbfs.Merged)
	if err != nil {
		return libkbfs.TlfID{}, err
	}

	if irmd == (libkbfs.ImmutableRootMetadata{}) {
		return libkbfs.TlfID{}, fmt.Errorf(
			"Could not get TLF ID for %q", tlfStr)
	}

	return irmd.TlfID(), nil
}

func getBranchID(ctx context.Context, config libkbfs.Config,
	tlfID libkbfs.TlfID, branchStr string) (libkbfs.BranchID, error) {
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
	tlfID libkbfs.TlfID, branchID libkbfs.BranchID,
	revisionStr string) (libkbfs.MetadataRevision, error) {
	if len(revisionStr) == 0 || revisionStr == "latest" {
		if branchID == libkbfs.NullBranchID {
			irmd, err := config.MDOps().GetForTLF(ctx, tlfID)
			if err != nil {
				return libkbfs.MetadataRevisionUninitialized,
					err
			}
			return irmd.Revision(), nil
		}

		irmd, err := config.MDOps().GetUnmergedForTLF(
			ctx, tlfID, branchID)
		if err != nil {
			return libkbfs.MetadataRevisionUninitialized, err
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
		return libkbfs.MetadataRevisionUninitialized, err
	}
	return libkbfs.MetadataRevision(u), nil
}

func mdGet(ctx context.Context, config libkbfs.Config, tlfID libkbfs.TlfID,
	branchID libkbfs.BranchID, rev libkbfs.MetadataRevision) (
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
