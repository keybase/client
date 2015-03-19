#!/usr/bin/env ruby

require 'rexml/document'
require_relative 'appcast'

appcast = Screenhero::Sparkle::AppCast.new(
	name: "Keybase",
	description: "Keybase updates",
	appcast_url: "https://keybase-app.s3.amazonaws.com/appcast.xml")

appcast.add_item(
	"0.1.4",
	"../Keybase-0.1.4.dmg",
	"https://keybase-app.s3.amazonaws.com/Keybase-0.1.4.dmg",
	"https://keybase-app.s3.amazonaws.com/Keybase-0.1.4.html")

puts appcast.to_s
