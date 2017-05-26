package main

import (
	"flag"
	"fmt"

	"github.com/keybase/kbfs/libkbfs"
	"golang.org/x/net/context"
)

func mdForceQROne(
	ctx context.Context, config libkbfs.Config, tlfPath string,
	dryRun bool) error {
	// Get the latest head, and add a QR record up to that point.
	irmd, _, err := mdGetMergedHeadForWriter(ctx, config, tlfPath)
	if err != nil {
		return err
	}

	rmdNext, err := irmd.MakeSuccessor(ctx, config.MetadataVersion(),
		config.Codec(), config.Crypto(), config.KeyManager(),
		config.KBPKI(), config.KBPKI(), irmd.MdID(), true)
	if err != nil {
		return err
	}

	// Pretend like we've done quota reclamation up through the
	// current head.
	gco := &libkbfs.GCOp{
		LatestRev: irmd.Revision(),
	}
	rmdNext.AddOp(gco)
	rmdNext.SetLastGCRevision(irmd.Revision())

	fmt.Printf(
		"Will put a forced QR op up to revision %d:\n", irmd.Revision())
	err = mdDumpReadOnlyRMD(ctx, config, rmdNext.ReadOnly())
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

	newIrmd, err := config.MDOps().Put(ctx, rmdNext, session.VerifyingKey)
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

	err = mdForceQROne(ctx, config, inputs[0], *dryRun)
	if err != nil {
		printError("md forceQR", err)
		return 1
	}

	fmt.Print("\n")

	return 0
}
