// Copyright 2018 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"golang.org/x/net/context"
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

type Consumer struct {
	ingestChan chan string
	jobsChan   chan string
	outChan    chan string
	cli        *stellar1.LocalClient
	wg         *sync.WaitGroup
	outfile    *os.File
	dui        libkb.DumbOutputUI
}

// workerFunc starts a single worker function that will range on the
// jobsChan until that channel closes.
func (c Consumer) workerFunc(index int) {
	defer c.wg.Done()

	fmt.Printf("Consumer %d starting\n", index)
	for txID := range c.jobsChan {
		// simulate work  taking between 1-3 seconds
		fmt.Printf("Consumer %d started job %s\n", index, txID)
		time.Sleep(time.Millisecond * time.Duration(1000+rand.Intn(2000)))
		c.outChan <- txID
		fmt.Printf("Consumer %d finished processing job %s\n", index, txID)
		/*res, err := c.cli.ClaimCLILocal(context.TODO(), stellar1.ClaimCLILocalArg{TxID: txID})
		if err != nil {
			// you may want to add more cases for when an erroring txID should be
			// added to out.txt

			if strings.Contains(err.Error(), "Payment already claimed by ") {
				c.dui.Printf("SKIP: %+v, %+v\n", txID, err.Error())
				//			skipCount++
				if c.outfile != nil {
					if _, err := c.outfile.WriteString(fmt.Sprintf("%+v\n", txID)); err != nil {
						fmt.Printf("WRITE ERROR, %+v, %+v\n", txID, err.Error())
						//					writeErrorCount++
					}
				}
			} else {
				c.dui.Printf("ERROR: %+v, %+v\n", txID, err.Error())
				//			failCount++
			}
		} else {
			c.dui.Printf("SUCCESS: %+v, %+v\n", txID, res)
			//		successCount++
			if c.outfile != nil {
				if _, err := c.outfile.WriteString(fmt.Sprintf("%+v\n", txID)); err != nil {
					fmt.Printf("WRITE ERROR, %+v, %+v\n", txID, err.Error())
					//				writeErrorCount++
				}
			}
		}
		*/
	}
	fmt.Printf("Consumer %d interrupted\n", index)
}

// startConsumer acts as the proxy between the ingestChan and jobsChan, with a
// select to support graceful shutdown.
func (c Consumer) startConsumer(ctx context.Context) {
	go func() {
		defer c.wg.Done()
		for txID := range c.outChan {
			if c.outfile != nil {
				if _, err := c.outfile.WriteString(fmt.Sprintf(">>>>%+v\n", txID)); err != nil {
					c.dui.Printf("WRITE ERROR, %+v, %+v\n", txID, err.Error())
					//				writeErrorCount++
				}
			}
		}
	}()
	for {
		select {
		case job := <-c.ingestChan:
			c.jobsChan <- job
		case <-ctx.Done():
			fmt.Println("Consumer received cancellation signal, closing jobsChan!")
			close(c.jobsChan)
			fmt.Println("Consumer closed jobsChan")
			return
		}
	}
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

	maxConsumers := 5

	var wg sync.WaitGroup
	// create the consumer
	worker := Consumer{
		ingestChan: make(chan string, maxConsumers),
		jobsChan:   make(chan string),
		outChan:    make(chan string),
		cli:        &cli,
		wg:         &wg,
		outfile:    outfile,
		dui:        dui,
	}

	go func() {
		for _, txID := range in {
			worker.ingestChan <- txID
		}
	}()

	// Set up cancellation context and waitgroup
	ctx, cancelFunc := context.WithCancel(context.Background())

	// Start consumer with cancellation context passed
	go worker.startConsumer(ctx)

	// Start workers and Add [maxConsumers] to WaitGroup
	wg.Add(maxConsumers + 1)
	for i := 0; i < maxConsumers; i++ {
		go worker.workerFunc(i)
	}

	// Handle sigterm and await termChan signal
	termChan := make(chan os.Signal)
	signal.Notify(termChan, syscall.SIGINT, syscall.SIGTERM)

	<-termChan // Blocks here until interrupted

	// Handle shutdown
	dui.Printf("*********************************\nShutdown signal received\n*********************************\n")
	cancelFunc() // Signal cancellation to context.Context
	wg.Wait()    // Block here until are workers are done
	dui.Printf("All workers done, shutting down!\n")
	return nil

	/////////////////////////////
	/////////////////////////////

	/*
				var successCount, skipCount, failCount, writeErrorCount int

				sigChan := make(chan os.Signal, 1)
				signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
				doneChan := make(chan bool, 1)
				go func() {
					// if we get a signal, abort
					sig := <-sigChan
					dui.Printf("1Received signal! %s. Aborting script. Can't wait for outstanding goroutines. So far: successCount=%d, skipCount=%d, failCount=%d, writeErrorCount=%d\n\n", sig, successCount, skipCount, failCount, writeErrorCount)
					dui.Printf("wg = %+v\n", wg)
					doneChan <- true
				}()
			dui.Printf("Canceling %d txIDs with %d maxConsumers; %d txIDs already complete...\n", len(in), maxConsumers, len(out))
			for _, txID := range in {
				// non-blocking check of `done` channel
				select {
				case _ = <-doneChan:
					// don't start any more transaction goroutines
					dui.Printf("111XXXXXReceived signal! Aborting script. Can't wait for outstanding goroutines. So far: successCount=%d, skipCount=%d, failCount=%d, writeErrorCount=%d\n\n", successCount, skipCount, failCount, writeErrorCount)
					wg.Wait() // wait until all goroutines have complete
					return nil
				default:
				}

				// block until we can acquire a worker
				if err := sem.Acquire(context.TODO(), 1); err != nil {
					// don't expect to get here
					log.Printf("Failed to acquire semaphore: %v", err)
					return err
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

		wg.Wait() // wait until all goroutines have complete
		dui.Printf("Finished canceling. successCount=%d, skipCount=%d, failCount=%d, writeErrorCount=%d\n\n", successCount, skipCount, failCount, writeErrorCount)
		return nil

	*/
}

func (c *cmdWalletCancelAll) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}
