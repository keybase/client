// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/nlopes/slack"
)

type Bot struct {
	api        *slack.Client
	rtm        *slack.RTM
	commands   map[string]Command
	channelIDs map[string]string
}

type Command struct {
	trigger    string   // Trigger without the ! (e.g. "build")
	execute    string   // Command to execute
	args       []string // Args for command
	showResult bool     // Whether to output result back to channel
}

func NewBot(token string) (*Bot, error) {
	api := slack.New(token)
	//api.SetDebug(true)

	channels, err := api.GetChannels(true)
	if err != nil {
		return nil, err
	}
	channelIDs := make(map[string]string)
	for _, c := range channels {
		fmt.Printf("%s %s\n", c.ID, c.Name)
		channelIDs[c.Name] = c.ID
	}

	rtm := api.NewRTM()
	commands := make(map[string]Command)

	bot := Bot{api: api, rtm: rtm, commands: commands, channelIDs: channelIDs}
	return &bot, nil
}

func (b *Bot) AddCommand(command Command) {
	b.commands[command.trigger] = command
}

func (b *Bot) RunCommand(trigger string, channel string) {
	command, ok := b.commands[trigger]
	if !ok {
		log.Printf("Unrecognized command: %s", trigger)
		return
	}

	log.Printf("Command: %#v\n", command)
	b.SendMessage(fmt.Sprintf("Sure, I will !%s", command.trigger), channel)

	go b.execute(command, channel)
}

func (b *Bot) execute(command Command, channel string) {
	out, err := exec.Command(command.execute, command.args...).Output()
	if err != nil {
		log.Printf("Error %s running: %#v; %s\n", err, command, out)
		b.SendMessage(fmt.Sprintf("Oops, there was an error in !%s", command.trigger), channel)
		return
	}
	log.Printf("Output: %s\n", out)
	if command.showResult {
		b.SendMessage(fmt.Sprintf("%s", command.trigger, out), channel)
	}
}

func (b *Bot) SendMessage(text string, channel string) {
	cid := b.channelIDs[channel]
	if cid == "" {
		cid = channel
	}
	b.rtm.SendMessage(b.rtm.NewOutgoingMessage(text, cid))
}

func (b *Bot) Listen() {
	go b.rtm.ManageConnection()

Loop:
	for {
		select {
		case msg := <-b.rtm.IncomingEvents:
			switch ev := msg.Data.(type) {
			case *slack.HelloEvent:

			case *slack.ConnectedEvent:

			case *slack.MessageEvent:
				text := strings.TrimSpace(ev.Text)
				if strings.HasPrefix(text, "!") {
					cmd := text[1:]
					b.RunCommand(cmd, ev.Channel)
				}

			case *slack.PresenceChangeEvent:
				//log.Printf("Presence Change: %v\n", ev)

			case *slack.LatencyReport:
				//log.Printf("Current latency: %v\n", ev.Value)

			case *slack.RTMError:
				log.Printf("Error: %s\n", ev.Error())

			case *slack.InvalidAuthEvent:
				log.Printf("Invalid credentials\n")
				break Loop

			default:
				// log.Printf("Unexpected: %v\n", msg.Data)
			}
		}
	}
}

func main() {
	token := os.Getenv("SLACK_TOKEN")
	if token == "" {
		log.Fatal("SLACK_TOKEN is not set")
	}

	bot, err := NewBot(token)
	if err != nil {
		log.Fatal(err)
	}

	// For debugging
	bot.AddCommand(Command{trigger: "date", execute: "/bin/date", showResult: true})

	bot.AddCommand(Command{trigger: "build", execute: "/bin/launchctl", args: []string{"start", "keybase.prerelease"}})

	bot.Listen()
}
