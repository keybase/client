// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"sync"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
	"golang.org/x/sync/semaphore"
)

type cmdWalletCancelAll struct {
	libkb.Contextified
	infile  string
	outfile string
}

func newCmdWalletCancelAll(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletCancelAll{
		Contextified: libkb.NewContextified(g),
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

func (c *cmdWalletCancelAll) getInTxIDs(out map[string]bool) (in []string, err error) {
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

func (c *cmdWalletCancelAll) Run() (err error) {
	defer transformStellarCLIError(&err)
	dui := c.G().UI.GetDumbOutputUI()
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	out, err := c.getOutTxIDs()
	if err != nil {
		return err
	}
	in, err := c.getInTxIDs(out)
	if err != nil {
		return err
	}

	var outfile *os.File = nil
	// if c.outfile defined, append finished txIDs
	if len(c.outfile) > 0 {
		outfile, err = os.OpenFile("out.txt",
			os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return err
		}
		defer outfile.Close()
	} else {
		dui.Printf("Note: no outfile specified, so not keeping track of complete txIDs.\n")
	}

	maxWorkers := 100 // OR runtime.GOMAXPROCS(0)
	sem := semaphore.NewWeighted(int64(maxWorkers))
	dui.Printf("Canceling %d txIDs with %d maxWorkers; %d txIDs already complete...\n", len(in), maxWorkers, len(out))

	var wg sync.WaitGroup
	var successCount, skipCount, failCount, writeErrorCount int
	for _, txID := range in {
		if err := sem.Acquire(context.TODO(), 1); err != nil {
			// don't expect to get here
			log.Printf("Failed to acquire semaphore: %v", err)
			return nil
		}
		wg.Add(1)
		go func(txID string) {
			defer func() {
				sem.Release(1)
				wg.Done()
			}()
			res, err := cli.ClaimCLILocal(context.TODO(), stellar1.ClaimCLILocalArg{TxID: txID})
			if err != nil {
				// you may want to add more cases for when an erroring txID should be
				// added to out.txt
				if strings.Contains(err.Error(), "Payment already claimed by ") {
					dui.Printf("SKIP: %+v, %+v\n", txID, err.Error())
					skipCount++
					if outfile != nil {
						if _, err := outfile.WriteString(fmt.Sprintf("%+v\n", txID)); err != nil {
							fmt.Printf("WRITE ERROR, %+v, %+v\n", txID, err.Error())
							writeErrorCount++
						}
					}
				} else {
					dui.Printf("ERROR: %+v, %+v\n", txID, err.Error())
					failCount++
				}
			} else {
				dui.Printf("SUCCESS: %+v, %+v\n", txID, res)
				successCount++
				if outfile != nil {
					if _, err := outfile.WriteString(fmt.Sprintf("%+v\n", txID)); err != nil {
						fmt.Printf("WRITE ERROR, %+v, %+v\n", txID, err.Error())
						writeErrorCount++
					}
				}
			}
		}(txID)
	}

	wg.Wait()
	dui.Printf("Finished canceling. successCount=%d, skipCount=%d, failCount=%d, writeErrorCount=%d\n\n", successCount, skipCount, failCount, writeErrorCount)
	return nil
}

func (c *cmdWalletCancelAll) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
