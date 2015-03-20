#!/usr/bin/env ruby
require 'time'
require_relative 'sparkle'

appcast = Screenhero::Sparkle::AppCast.new(
	name: "Keybase",
	description: "Keybase updates",
	appcast_url: "https://keybase-app.s3.amazonaws.com/appcast.xml")


appcast.add_item(
	"0.1.5",
	"../Keybase-0.1.5.dmg",
	"https://keybase-app.s3.amazonaws.com/Keybase-0.1.5.dmg",
	"https://keybase-app.s3.amazonaws.com/Keybase-0.1.5.html",
	Time.parse("2015-03-16 5:24 PM"))

appcast.add_item(
	"0.1.4",
	"../Keybase-0.1.4.dmg",
	"https://keybase-app.s3.amazonaws.com/Keybase-0.1.4.dmg",
	"https://keybase-app.s3.amazonaws.com/Keybase-0.1.4.html",
	Time.parse("2015-03-16 4:52 PM"))


File.write("site/appcast.xml", appcast.to_s)

