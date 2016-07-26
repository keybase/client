package internal

import "github.com/keybase/client/go/logger"

type Logger interface {
	logger.FLogger
	logger.ContextFLogger

	CloneWithAddedDepth(depth int) Logger
}
