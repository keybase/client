//
//  KBPrefGeneralView.m
//  Keybase
//
//  Created by Gabriel on 4/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefGeneralView.h"

#import "KBPrefCheckbox.h"
#import "KBPrefPopUpView.h"
#import "KBPrefOption.h"

#import "KBApp.h"
//#import <Sparkle/Sparkle.h>
#import <CocoaLumberjack/CocoaLumberjack.h>

@implementation KBPrefGeneralView

- (instancetype)initWithPreferences:(KBPreferences *)preferences {
  if ((self = [super init])) {
    [self setOptions:@{@"spacing": @"10", @"insets": @"40,0,40,0"}];

    KBPrefCheckbox *launchAtLogin = [[KBPrefCheckbox alloc] init];
    [launchAtLogin setCategory:@"System"];
    [launchAtLogin setLabelText:@"Launch Keybase at login" identifier:@"Preferences.LaunchAtLogin" preferences:self];
    [self addSubview:launchAtLogin];

    KBPrefCheckbox *autoUpdate = [[KBPrefCheckbox alloc] init];
    [autoUpdate setCategory:@"Updater"];
    [autoUpdate setLabelText:@"Automatically check for updates" identifier:@"Preferences.Sparkle.AutoUpdate" preferences:self];
    [self addSubview:autoUpdate];

    KBPrefPopUpView *updateCheckInterval = [[KBPrefPopUpView alloc] init];
    updateCheckInterval.inset = 170;
    updateCheckInterval.fieldWidth = 150;
    NSArray *udpateCheckOptions = @[[KBPrefOption prefOptionWithLabel:@"Hour" value:@(3600)],
                                    [KBPrefOption prefOptionWithLabel:@"Day" value:@(86400)],
                                    [KBPrefOption prefOptionWithLabel:@"Week" value:@(604800)],
                                    [KBPrefOption prefOptionWithLabel:@"Month" value:@(2629800)],
                                    ];
    [updateCheckInterval setLabelText:@"Check Every" options:udpateCheckOptions identifier:@"Preferences.Sparkle.CheckInterval" preferences:self];
    [self addSubview:updateCheckInterval];

    KBPrefCheckbox *autoDownload = [[KBPrefCheckbox alloc] init];
    [autoDownload setLabelText:@"Automatically download updates" identifier:@"Preferences.Sparkle.AutoDownload" preferences:self];
    [self addSubview:autoDownload];

    KBPrefCheckbox *sendsProfile = [[KBPrefCheckbox alloc] init];
    [sendsProfile setLabelText:@"Sends system profile" identifier:@"Preferences.Sparkle.SendsProfile" preferences:self];
    [self addSubview:sendsProfile];

    KBPrefPopUpView *logLevel = [[KBPrefPopUpView alloc] init];
    logLevel.inset = 0;
    logLevel.labelWidth = 140;
    logLevel.fieldWidth = 150;
    NSArray *logLevelOptions = @[[KBPrefOption prefOptionWithLabel:@"Verbose" value:@(DDLogLevelVerbose)],
                                 [KBPrefOption prefOptionWithLabel:@"Debug" value:@(DDLogLevelDebug)],
                                 [KBPrefOption prefOptionWithLabel:@"Info" value:@(DDLogLevelInfo)],
                                 [KBPrefOption prefOptionWithLabel:@"Warn" value:@(DDLogLevelWarning)],
                                 [KBPrefOption prefOptionWithLabel:@"Error" value:@(DDLogLevelError)],
                                 [KBPrefOption prefOptionWithLabel:@"Off" value:@(DDLogLevelOff)],
                                 ];
    [logLevel setLabelText:@"Logging" options:logLevelOptions identifier:@"Preferences.Log.Level" preferences:preferences];
    [self addSubview:logLevel];
  }
  return self;
}

- (id)valueForIdentifier:(NSString *)identifier {
  id value = [[NSApp delegate] preferencesValueForIdentifier:identifier];
  NSAssert(value, @"Unknown preference: %@", identifier);
  return value;
}

- (void)setValue:(id)value forIdentifier:(NSString *)identifier synchronize:(BOOL)synchronize {
  [[NSApp delegate] setPrefencesValue:value forIdentifier:identifier synchronize:synchronize];
}

@end
