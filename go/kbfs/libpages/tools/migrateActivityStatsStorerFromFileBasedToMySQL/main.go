package main

import (
	"os"

	_ "github.com/go-sql-driver/mysql"
	"github.com/keybase/client/go/kbfs/libpages"
	"go.uber.org/zap"
)

const dsnENV = "DSN"

func main() {
	logger, err := zap.NewDevelopmentConfig().Build()
	if err != nil {
		panic(err)
	}
	libpages.MigrateActivityStatsStorerFromFileBasedToMySQL(
		logger, os.Args[1], os.Getenv(dsnENV))
}
