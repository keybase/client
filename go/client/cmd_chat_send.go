// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package client

import (
	"errors"
	"fmt"
	"io/ioutil"
	"os"

	"golang.org/x/net/context"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
)

type cmdChatSend struct {
	libkb.Contextified
	message      string
	resolver     chatCLIConversationResolver
	setTopicName string
}

func newCmdChatSend(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "send",
		Usage:        "Send a message to a conversation",
		ArgumentHelp: "[conversation [message]]",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(&cmdChatSend{Contextified: libkb.NewContextified(g)}, "send", c)
		},
		Flags: mustGetChatFlags("topic-type", "topic-name", "set-topic-name", "stdin"),
	}
}

func (c *cmdChatSend) Run() (err error) {
	chatClient, err := GetChatLocalClient(c.G())
	if err != nil {
		return err
	}

	tlfClient, err := GetTlfClient(c.G())
	if err != nil {
		return err
	}

	ctx := context.TODO()

	var conversationInfo chat1.ConversationInfoLocal
	resolved, userChosen, err := c.resolver.Resolve(context.TODO(), c.G(), chatClient, tlfClient)
	if err != nil {
		return err
	}

	if resolved == nil {
		var tnp *string
		if len(c.resolver.TopicName) > 0 {
			tnp = &c.resolver.TopicName
		}
		ncres, err := chatClient.NewConversationLocal(ctx, chat1.NewConversationLocalArg{
			TlfName:       c.resolver.TlfName,
			TopicName:     tnp,
			TopicType:     c.resolver.TopicType,
			TlfVisibility: c.resolver.Visibility,
		})
		if err != nil {
			return fmt.Errorf("creating conversation error: %v\n", err)
		}
		conversationInfo = ncres.Conv.Info
	} else {
		conversationInfo = *resolved
	}

	switch {
	case userChosen && len(c.message) == 0:
		c.message, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, fmt.Sprintf("Send to [%s]? Hit Ctrl-C to cancel, or enter message content to send: ", conversationInfo.TlfName))
		if err != nil {
			return err
		}
	case userChosen:
		return errors.New("potential command line argument parsing error: we had a message before letting user choose a conversation")
	case len(c.message) == 0:
		c.message, err = c.G().UI.GetTerminalUI().Prompt(PromptDescriptorEnterChatMessage, "Please enter message content: ")
		if err != nil {
			return err
		}
	default:
	}

	var args chat1.PostLocalArg
	args.ConversationID = conversationInfo.Id

	prev, err := getPrevPointers(chatClient, conversationInfo.Id)
	if err != nil {
		return err
	}

	var msgV1 chat1.MessagePlaintextV1
	// msgV1.ClientHeader.{Sender,SenderDevice} are filled by service
	msgV1.ClientHeader.Conv = conversationInfo.Triple
	msgV1.ClientHeader.TlfName = conversationInfo.TlfName
	msgV1.ClientHeader.MessageType = chat1.MessageType_TEXT
	msgV1.ClientHeader.Prev = prev
	msgV1.MessageBody = chat1.NewMessageBodyWithText(chat1.MessageText{Body: c.message})

	args.MessagePlaintext = chat1.NewMessagePlaintextWithV1(msgV1)

	if _, err = chatClient.PostLocal(ctx, args); err != nil {
		return err
	}

	if len(c.setTopicName) > 0 {
		if conversationInfo.Triple.TopicType == chat1.TopicType_CHAT {
			c.G().UI.GetTerminalUI().Printf("We are not supporting setting topic name for chat conversations yet. Ignoring --set-topic-name >.<")
		}
		msgV1.ClientHeader.MessageType = chat1.MessageType_METADATA
		// Recompute the prev pointers again from scratch. Right now this is
		// hilariously expensive, but in the future when everything is from
		// cache it might be a reasonable thing to do?
		prev, err := getPrevPointers(chatClient, conversationInfo.Id)
		if err != nil {
			return err
		}
		msgV1.ClientHeader.Prev = prev
		msgV1.MessageBody = chat1.NewMessageBodyWithMetadata(chat1.MessageConversationMetadata{ConversationTitle: c.setTopicName})
		args.MessagePlaintext = chat1.NewMessagePlaintextWithV1(msgV1)
		if _, err := chatClient.PostLocal(ctx, args); err != nil {
			return err
		}
	}

	return nil
}

// We need to fetch the set of messages that have not yet been pointed to by
// anything else.
// TODO: All of this should happen in the cache instead of doing any fetching.
func getPrevPointers(client chat1.LocalClient, convID chat1.ConversationID) ([]chat1.MessagePreviousPointer, error) {
	// For now, fetch essentially all messages (10k by default).
	arg := chat1.GetThreadLocalArg{
		ConversationID: convID,
	}
	res, err := client.GetThreadLocal(context.TODO(), arg)
	if err != nil {
		return nil, err
	}

	// Filter out the messages that gave unboxing errors, and index the rest by
	// ID. Enforce that there are no duplicate IDs.
	// TODO: What should we really be doing with unboxing errors? Do we worry
	//       about an evil server causing them intentionally?
	knownMessages := make(map[chat1.MessageID]chat1.MessageFromServer)
	for _, messageOrError := range res.Thread.Messages {
		if messageOrError.Message != nil {
			msg := *messageOrError.Message
			id := msg.ServerHeader.MessageID

			// Check for IDs that show up more than once. IDs are assigned
			// sequentially by the server, so this should really never happen.
			_, alreadyExists := knownMessages[id]
			if alreadyExists {
				return nil, fmt.Errorf("MessageID %d is duplicated in conversation %d", id, convID)
			}

			knownMessages[id] = msg
		}
	}

	// Using the index we built above, check each prev pointer on each message
	// to make sure its hash is correct, and assemble the set of IDs that have
	// ever been pointed to. (Some prev pointers might refer to IDs we've never
	// seen. That's ok.) While we're at it, also enforce that each prev's ID is
	// less than the ID of the message that's pointing to it.
	seenPrevs := make(map[chat1.MessageID]struct{})
	for id, msg := range knownMessages {
		plaintext := msg.MessagePlaintext.V1()
		for _, prev := range plaintext.ClientHeader.Prev {
			// Check that the prev's ID doesn't come after us. That would make no sense.
			if prev.Id > id {
				return nil, fmt.Errorf("MessageID %d thinks that message %d is previous.", id, prev.Id)
			}

			// We might not have seen this ID before. (Unlikely while we're
			// fetching up to 10k messages from the server, but more likely in
			// the future when we're working from cache.) That's fine.
			// TODO: Even if we can't confirm Message X's hash, should we
			//       enforce that everyone agrees on what we *expect* it to be?
			seenMsg, seen := knownMessages[prev.Id]
			if !seen {
				continue
			}

			// Check the hash in the prev pointer against the real hash of the
			// message. Note that HeaderHash is computed *locally* at unbox
			// time; we're not taking anyone's word for it.
			if !seenMsg.HeaderHash.Eq(prev.Hash) {
				return nil, fmt.Errorf("Message ID %d thinks message ID %d should have hash %s, but it has %s.",
					id, prev.Id, prev.Hash.String(), seenMsg.HeaderHash.String())
			}

			// Make a note that we've seen this pointer.
			seenPrevs[prev.Id] = struct{}{}
		}
	}

	// Finally, figure out the list of IDs that we know about but which did
	// *not* show up in anyone's prev pointers. This will be the prev set of
	// our new message.
	newPrevs := []chat1.MessagePreviousPointer{}
	for id, msg := range knownMessages {
		_, pointedToBefore := seenPrevs[id]
		if !pointedToBefore {
			newPrevs = append(newPrevs, chat1.MessagePreviousPointer{
				Id:   id,
				Hash: msg.HeaderHash, // Again, we computed this hash ourselves.
			})
		}
	}

	return newPrevs, nil
}

func (c *cmdChatSend) ParseArgv(ctx *cli.Context) (err error) {
	switch len(ctx.Args()) {
	case 2:
		c.message = ctx.Args().Get(1)
		fallthrough
	case 1:
		tlfName := ctx.Args().Get(0)
		if c.resolver, err = parseConversationResolver(ctx, tlfName); err != nil {
			return err
		}
	case 0:
		if ctx.Bool("stdin") {
			return fmt.Errorf("--stdin requires 1 argument [conversation]")
		}
		if c.resolver, err = parseConversationResolver(ctx, ""); err != nil {
			return err
		}
	default:
		return fmt.Errorf("keybase chat send takes 1 or 2 args")
	}

	if ctx.Bool("stdin") {
		bytes, err := ioutil.ReadAll(os.Stdin)
		if err != nil {
			return err
		}
		c.message = string(bytes)
	}

	c.setTopicName = ctx.String("set-topic-name")

	return nil
}

func (c *cmdChatSend) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}
