package client

import (
	"fmt"
	"strings"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"golang.org/x/net/context"
)

type cmdWalletGetStarted struct {
	libkb.Contextified
	accepted bool
}

func newCmdWalletGetStarted(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &cmdWalletGetStarted{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name:         "get-started",
		Usage:        "Setup your Stellar wallet",
		ArgumentHelp: "[i agree]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "get-started", c)
		},
	}
}

func (c *cmdWalletGetStarted) ParseArgv(ctx *cli.Context) error {
	switch len(ctx.Args()) {
	case 0:
		return nil
	case 2:
		got := fmt.Sprintf("%s %s", ctx.Args()[0], ctx.Args()[1])
		if strings.ToLower(got) != "i agree" {
			return fmt.Errorf("unexpected arguments: %v", got)
		}
		c.accepted = true
		return nil
	default:
		return fmt.Errorf("unexpected arguments")
	}
}

func (c *cmdWalletGetStarted) Run() (err error) {
	if !c.accepted {
		err = c.show()
		if err != nil {
			return err
		}
	}
	if c.accepted {
		return c.accept()
	}
	return fmt.Errorf("Disclaimer not accepted")
}

func (c *cmdWalletGetStarted) show() (err error) {
	ui := c.G().UI.GetTerminalUI()
	ui.PrintfUnescaped(disclaimerText)
	c.accepted, err = c.G().UI.GetTerminalUI().PromptYesNo(PromptDescriptorStellarDisclaimer, ColorString(c.G(), "yellow", "Ok, I agree"), libkb.PromptDefaultYes)
	return err
}

func (c *cmdWalletGetStarted) accept() error {
	cli, err := GetWalletClient(c.G())
	if err != nil {
		return err
	}

	err = cli.AcceptDisclaimerLocal(context.TODO(), 0)
	if err != nil {
		return err
	}
	ui := c.G().UI.GetTerminalUI()
	ui.PrintfUnescaped("\nYou now have a Stellar wallet!\n")
	ui.PrintfUnescaped("Try it out in the app or:\n$ keybase wallet list\n")

	return nil
}

func (c *cmdWalletGetStarted) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		KbKeyring: true,
	}
}

const disclaimerText = `Keybase supports Stellar wallets!

You can now send or request Stellar Lumens to any Keybase user on Earth. Transactions settle in seconds, and cost a fraction of a penny.

When sending and receiving Lumens, we automatically do the conversion in your favorite currency. We went ahead and set it to USD.

Almost ready. It's important you read this.

We believe Keybase can help make cryptocurrency usable for 2 reasons:
- We can make your Stellar private key sync with encryption across your devices, without exposing it to our servers. Cool!
- We can help you send and receive crypto just by knowing usernames. You can say goodbye to ugly "addresses" you have to pass around insecurely.

And we believe Stellar is in a unique position to solve payments because:
- It's ultra fast and ultra cheap
- It natively understands currencies and tokens
- The network itself has a decentralized exchange built into it
- It doesn't burn more electricity than small nations

But there are a few things you must agree to understand before using Stellar on Keybase:

1. IT'S BRAND NEW AND YOU ARE AMONG ITS FIRST TESTERS. Seriously, don't race off and buy more cryptocurrency than you're willing to lose. And don't manage tokens in Keybase that you're not willing to lose. We could have an exploitable bug in an early release. You're using this app at your own risk. Keybase will not reimburse for any lost cryptocurrency due to user error or Keybase error of any kind.

2. BY DESIGN, WE CAN'T RECOVER YOUR PRIVATE KEY. We don't actually hold your funds, we simply help you encrypt your keys. If you lose all your Keybase installs and paper keys, and if you haven't backed up your Stellar private key, you'll lose your Stellar account. Knowing your Keybase password is not enough info. Similarly, knowing your PGP private key isn't enough info. You must have access to a Keybase install (logged in as you) or Keybase paper key to recover your Stellar private key.

3. CRYPTOCURRENCY ISN'T REALLY ANONYMOUS. When you sign your first or "default" Stellar address into your signature chain on Keybase, you are announcing it publicly as a known address for you. Assume that all your transactions from that account are public. You can have as many Stellar accounts as you like in Keybase, but whenever you make one your default, that one is then announced as yours. Consider that data permanent.

4. DON'T "RESET" YOUR KEYBASE ACCOUNT. If you reset your Keybase account, that will let you recover your Keybase username, by killing all your keys. You'll lose your Stellar account in Keybase. So don't do a Keybase account reset unless you've backed up your Stellar private key(s).

5. AVOID SOCIAL ATTACKS. People may beg of thee for thine cryptocurrency. Pay attention to usernames, not photos and full names. Follow people on Keybase, so they turn green, which is a cryptographically signed action. And don't ever install software that other people send you, even if you trust those people. That software may be some kind of social worm. Keybase cannot be responsible for lost tokens due to bugs, hacks, or social attacks. Or anything else for that matter.

6. FINALLY HAVE FUN WHILE YOU CAN. Something is coming.

`
