package main

import (
	"errors"
	"flag"
	"fmt"

	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/libkbfs"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

func mdForceQROne(
	ctx context.Context, config libkbfs.Config,
	replacements replacementMap, input string, dryRun bool) error {
	tlfStr, branchStr, startStr, stopStr, err := mdSplitInput(input)
	if err != nil {
		return err
	}

	_, branchID, start, stop, err :=
		mdParseInput(ctx, config, tlfStr, branchStr, startStr, stopStr)
	if err != nil {
		return err
	}

	if branchID != kbfsmd.NullBranchID {
		return errors.New("force-qr doesn't support branch IDs")
	}
	if start != stop {
		return errors.New("force-qr doesn't support revision ranges")
	}

	// Get the latest head, and add a QR record up to that point.
	irmd, err := mdGetMergedHeadForWriter(ctx, config, tlfStr)
	if err != nil {
		return err
	}

	rmdNext, err := irmd.MakeSuccessor(ctx, config.MetadataVersion(),
		config.Codec(), config.KeyManager(),
		config.KBPKI(), config.KBPKI(), config, irmd.MdID(), true)
	if err != nil {
		return err
	}

	// Pretend like we've done quota reclamation up through the
	// specified revision.
	gco := &libkbfs.GCOp{
		LatestRev: start,
	}
	rmdNext.AddOp(gco)
	rmdNext.SetLastGCRevision(start)

	fmt.Printf(
		"Will put a forced QR op up to revision %d:\n", start)
	err = mdDumpReadOnlyRMD(ctx, config, "md forceQR", replacements, rmdNext.ReadOnly())
	if err != nil {
		return err
	}

	if dryRun {
		fmt.Print("Dry-run set; not doing anything\n")
		return nil
	}

	fmt.Printf("Putting revision %d...\n", rmdNext.Revision())

	session, err := config.KBPKI().GetCurrentSession(ctx)
	if err != nil {
		return err
	}

	newIrmd, err := config.MDOps().Put(
		ctx, rmdNext, session.VerifyingKey, nil, keybase1.MDPriorityNormal, nil)
	if err != nil {
		return err
	}

	fmt.Printf("New MD has revision %v\n", newIrmd.Revision())

	return nil
}

const mdForceQRUsageStr = `Usage:
  kbfstool md forceQR /keybase/[public|private]/user1,assertion2

`

func mdForceQR(ctx context.Context, config libkbfs.Config,
	args []string) (exitStatus int) {
	flags := flag.NewFlagSet("kbfs md forceQR", flag.ContinueOnError)
	dryRun := flags.Bool("d", false, "Dry run: don't actually do anything.")
	err := flags.Parse(args)
	if err != nil {
		printError("md forceQR", err)
		return 1
	}

	inputs := flags.Args()
	if len(inputs) != 1 {
		fmt.Print(mdForceQRUsageStr)
		return 1
	}

	replacements := make(replacementMap)

	err = mdForceQROne(ctx, config, replacements, inputs[0], *dryRun)
	if err != nil {
		printError("md forceQR", err)
		return 1
	}

	fmt.Print("\n")

	return 0
}
