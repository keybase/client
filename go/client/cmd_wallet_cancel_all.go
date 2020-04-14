// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
	"golang.org/x/sync/errgroup"
)

type cmdWalletCancelAll struct {
	libkb.Contextified
	infile  string
	outfile string
	done    context.CancelFunc
	group   *errgroup.Group
	gctx    context.Context
	stats   stats
}

type stats struct {
	successCount    int // cancel transaction succeeded and logged in outfile
	skipCount       int // transaction failed for a known benign reason, logged in outfile
	failCount       int // transaction failed for unexpected reason
	writeErrorCount int // cancel transaction succeeded, but failed to write to outfile
}

func (s stats) String() string {
	return fmt.Sprintf("Stats: successCount=%d, skipCount=%d, failCount=%d, writeErrorCount=%d\n", s.successCount, s.skipCount, s.failCount, s.writeErrorCount)
}

func newCmdWalletCancelAll(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	ctx, done := context.WithCancel(context.Background())
	group, gctx := errgroup.WithContext(ctx)
	cmd := &cmdWalletCancelAll{
		Contextified: libkb.NewContextified(g),
		done:         done,
		group:        group,
		gctx:         gctx,
	}
	return cli.Command{
		Name:     "cancel-all",
		Aliases:  []string{"reclaim-all"},
		Usage:    "Cancel all pending payments",
		Unlisted: true,
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "cancel-all", c)
		},
		Flags: []cli.Flag{
			cli.StringFlag{
				Name:  "i, infile",
				Usage: "Specify an input file.",
			},
			cli.StringFlag{
				Name:  "o, outfile",
				Usage: "Specify an output file (none by default).",
			},
		},
	}
}

func (c *cmdWalletCancelAll) ParseArgv(ctx *cli.Context) (err error) {
	if len(ctx.Args()) > 0 {
		return UnexpectedArgsError("wallet cancel-all")
	}
	c.outfile = ctx.String("outfile")
	c.infile = ctx.String("infile")
	return nil
}

func (c *cmdWalletCancelAll) Cancel() (err error) {
	dui := c.G().UI.GetDumbOutputUI()
	c.done()
	dui.Printf("\nCancel command was aborted! Now waiting for all workers to finish their current transaction...\n")
	_ = c.group.Wait()
	return nil
}

func (c *cmdWalletCancelAll) Run() (err error) {
	defer transformStellarCLIError(&err)
	dui := c.G().UI.GetDumbOutputUI()
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	// get txIDs to cancel
	in, err := c.getInTxIDs()
	if err != nil {
		return err
	}

	// if c.outfile defined, append finished txIDs
	var outfile *os.File
	if len(c.outfile) > 0 {
		outfile, err = os.OpenFile(c.outfile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return err
		}
		dui.Printf("Saving progress to %s\n", c.outfile)
		defer outfile.Close()
	} else {
		dui.Printf("Note: no outfile specified, so not keeping track of complete txIDs.\n")
	}

	maxConsumers := 5
	ingestChannel := make(chan string)

	// populate ingestChan
	c.group.Go(func() error {
		for _, txID := range in {
			select {
			case <-c.gctx.Done():
				break
			default:
				ingestChannel <- txID
			}
		}
		close(ingestChannel)
		c.done()
		return nil
	})

	writeToOutfile := func(txID string) {
		if outfile != nil {
			if _, err := outfile.WriteString(fmt.Sprintf("%s\n", txID)); err != nil {
				dui.Printf("WRITE ERROR for tx %s: %s\n", txID, err)
				c.stats.writeErrorCount++
			}
		}
	}

	// start maxConsumers workers
	for i := 0; i < maxConsumers; i++ {
		c.group.Go(func() error {
			for txID := range ingestChannel {
				res, err := cli.ClaimCLILocal(context.TODO(), stellar1.ClaimCLILocalArg{TxID: txID})
				if err != nil {
					// you may want to add more cases for when an erroring txID should be
					// added to out.txt
					if strings.Contains(err.Error(), "Payment already claimed by ") {
						dui.Printf("SKIP: %s, %s\n", txID, err)
						c.stats.skipCount++
						writeToOutfile(txID)
					} else {
						dui.Printf("ERROR: %+v, %+v\n", txID, err.Error())
						c.stats.failCount++
					}
				} else {
					dui.Printf("SUCCESS: %+v, %+v\n", txID, res)
					c.stats.successCount++
					writeToOutfile(txID)
				}
			}
			return nil
		})
	}

	err = c.group.Wait()
	dui.Printf("Finished canceling. %s", c.stats)
	if err != nil {
		dui.Printf("Not all goroutines finished with no errors: %s\n", err)
		return err
	}
	dui.Printf("All goroutines finished with no errors!\n")
	return nil

}

func (c *cmdWalletCancelAll) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

func (c *cmdWalletCancelAll) getInTxIDs() (in []string, err error) {

	// read outfile for already processed txIDs
	out, err := c.getOutTxIDs()
	if err != nil {
		return in, err
	}

	if len(c.infile) == 0 {
		return in, nil
	}

	file, err := os.Open(c.infile)
	if err != nil {
		return in, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		txid := scanner.Text()
		if _, ok := out[txid]; !ok {
			in = append(in, txid)
		}
	}
	if err := scanner.Err(); err != nil {
		return in, err
	}
	return in, nil
}

func (c *cmdWalletCancelAll) getOutTxIDs() (out map[string]bool, err error) {
	out = make(map[string]bool)
	if len(c.outfile) == 0 {
		return out, nil
	}

	file, err := os.Open(c.outfile)
	if err != nil {
		if os.IsNotExist(err) {
			dui := c.G().UI.GetDumbOutputUI()
			dui.Printf("output file %q does not exist, not loading any previous progress\n", c.outfile)
			return out, nil
		}
		return out, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		row := scanner.Text()
		out[row] = true
	}
	if err := scanner.Err(); err != nil {
		return out, err
	}
	return out, nil
}
