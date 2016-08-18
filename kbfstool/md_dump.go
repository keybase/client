package main

import (
	"flag"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/keybase/client/go/protocol"
	"github.com/keybase/kbfs/fsrpc"
	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

var mdGetRe = regexp.MustCompile("^(.+?)(?::(.*?))?(?:\\^(.*?))?$")

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

	return irmd.ID, nil
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
		return irmd.BID, nil
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
			return irmd.Revision, nil
		}

		irmd, err := config.MDOps().GetUnmergedForTLF(
			ctx, tlfID, branchID)
		if err != nil {
			return libkbfs.MetadataRevisionUninitialized, err
		}
		return irmd.Revision, nil
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
	matches := mdGetRe.FindStringSubmatch(input)
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

func getUserString(
	ctx context.Context, config libkbfs.Config, uid keybase1.UID) string {
	username, _, err := config.KeybaseService().Resolve(
		ctx, fmt.Sprintf("uid:%s", uid))
	if err != nil {
		printError("md dump", err)
		return uid.String()
	}
	return fmt.Sprintf("%s (uid:%s)", username, uid)
}

func mdDumpOne(ctx context.Context, config libkbfs.Config,
	rmd libkbfs.ImmutableRootMetadata) error {
	fmt.Printf("MD ID: %s\n", rmd.MdID())

	buf, err := config.Codec().Encode(&rmd.BareRootMetadata)
	if err != nil {
		return err
	}

	fmt.Printf("MD size: %d bytes\n\n", len(buf))

	fmt.Print("Reader/writer metadata\n")
	fmt.Print("----------------------\n")
	fmt.Printf("Last modifying user: %s\n",
		getUserString(ctx, config, rmd.LastModifyingUser))
	// TODO: Print flags.
	fmt.Printf("Revision: %s\n", rmd.Revision)
	fmt.Printf("Prev MD ID: %s\n", rmd.PrevRoot)
	// TODO: Print RKeys, unresolved readers, conflict info,
	// finalized info, and unknown fields.
	fmt.Print("\n")

	fmt.Print("Writer metadata\n")
	fmt.Print("---------------\n")
	fmt.Printf("Last modifying writer: %s\n",
		getUserString(ctx, config, rmd.LastModifyingWriter))
	// TODO: Print Writers/WKeys and unresolved writers.
	fmt.Printf("TLF ID: %s\n", rmd.ID)
	fmt.Printf("Branch ID: %s\n", rmd.BID)
	// TODO: Print writer flags.
	fmt.Printf("Disk usage: %d\n", rmd.DiskUsage)
	fmt.Printf("Bytes in new blocks: %d\n", rmd.RefBytes)
	fmt.Printf("Bytes in unreferenced blocks: %d\n", rmd.UnrefBytes)
	// TODO: Print unknown fields.
	fmt.Print("\n")

	fmt.Print("Private metadata\n")
	fmt.Print("----------------\n")
	fmt.Printf("Serialized size: %d bytes\n", len(rmd.SerializedPrivateMetadata))

	data := rmd.Data()
	// TODO: Clean up output.
	fmt.Printf("Dir: %s\n", data.Dir)
	fmt.Print("TLF private key: {32 bytes}\n")
	if data.ChangesBlockInfo() != (libkbfs.BlockInfo{}) {
		fmt.Printf("Block changes block: %v\n", data.ChangesBlockInfo())
	}
	for i, op := range data.Changes.Ops {
		fmt.Printf("Op[%d]: %v\n", i, op)
	}
	// TODO: Print unknown fields.

	return nil
}

const mdDumpUsageStr = `Usage:
  kbfstool md dump input [inputs...]

Each input must be in the following format:

  TLF
  TLF:Branch
  TLF^Revision
  TLF:Branch^Revision

where TLF can be:

  - a TLF ID string (32 hex digits),
  - or a keybase TLF path (e.g., "/keybase/public/user1,user2", or
    "/keybase/private/user1,assertion2");

Branch can be:

  - a Branch ID string (32 hex digits),
  - the string "device", which indicates the unmerged branch for the
    current device, or the master branch if there is no unmerged branch,
  - the string "master", which is a shorthand for
    the ID of the master branch "00000000000000000000000000000000", or
  - omitted, in which case it is treated as if it were the string "device";

and Revision can be:

  - a hex number prefixed with "0x",
  - a decimal number with no prefix,
  - the string "latest", which indicates the latest revision for the
    branch, or
  - omitted, in which case it is treated as if it were the string "latest".

`

func mdDump(ctx context.Context, config libkbfs.Config, args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs md dump", flag.ContinueOnError)
	flags.Parse(args)

	inputs := flags.Args()
	if len(inputs) < 1 {
		fmt.Print(mdDumpUsageStr)
		return 1
	}

	for _, input := range inputs {
		irmd, err := mdParseAndGet(ctx, config, input)
		if err != nil {
			printError("md dump", err)
			return 1
		}

		if irmd == (libkbfs.ImmutableRootMetadata{}) {
			fmt.Printf("No result found for %q\n\n", input)
			continue
		}

		fmt.Printf("Result for %q:\n\n", input)

		err = mdDumpOne(ctx, config, irmd)
		if err != nil {
			printError("md dump", err)
			return 1
		}

		fmt.Print("\n")
	}

	return 0
}
