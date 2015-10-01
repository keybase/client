package service

import (
	"testing"
)

func TestGetConfig(t *testing.T) {
	setupServiceTest(t)
	configHandler := ConfigHandler{}
	config, err := configHandler.GetConfig(0)
	if err != nil {
		t.Fatal(err)
	}
	if config.ServerURI == "" {
		t.Fatal("No service URI")
	}
}
