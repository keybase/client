//
//  KBPreferences.m
//  Keybase
//
//  Created by Gabriel on 2/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPreferences.h"

#import <Cocoa/Cocoa.h>
//#import <MASPreferences/MASPreferencesWindowController.h>
#import <Tikppa/Tikppa.h>

#import "KBPrefGeneralView.h"
#import "KBPrefAdvancedView.h"
#import "KBPrefGPGView.h"
#import "KBDefines.h"

@interface KBPreferences ()
//@property MASPreferencesWindowController *preferencesWindowController;
@property NSUserDefaults *userDefaults;
@end

@interface KBPreferencesViewController : NSViewController //<MASPreferencesViewController>
@property (nonatomic) NSImage *toolbarItemImage;
@property (nonatomic) NSString *toolbarItemLabel;
@end

@implementation KBPreferencesViewController
@end

@implementation KBPreferences

- (void)openWithUserDefaults:(NSUserDefaults *)userDefaults sender:(id)sender {
  _userDefaults = userDefaults;

  //[_preferencesWindowController.window close];

  KBPreferencesViewController *generalViewController = [[KBPreferencesViewController alloc] init];
  generalViewController.view = [[KBPrefGeneralView alloc] initWithPreferences:self];
  generalViewController.view.frame = CGRectMake(0, 0, 600, 400);
  generalViewController.identifier = @"General";
  generalViewController.toolbarItemImage = [NSImage imageNamed:NSImageNamePreferencesGeneral];
  generalViewController.toolbarItemLabel = @"General";

  KBPreferencesViewController *gpgViewController = [[KBPreferencesViewController alloc] init];
  gpgViewController.view = [[KBPrefGPGView alloc] initWithPreferences:self];
  gpgViewController.view.frame = CGRectMake(0, 0, 600, 400);
  gpgViewController.identifier = @"GPG";
  gpgViewController.toolbarItemImage = [KBIcons imageForIcon:KBIconPGP];
  gpgViewController.toolbarItemLabel = @"GPG";    

  KBPreferencesViewController *advancedViewController = [[KBPreferencesViewController alloc] init];
  advancedViewController.view = [[KBPrefAdvancedView alloc] initWithPreferences:self];
  advancedViewController.view.frame = CGRectMake(0, 0, 600, 400);
  advancedViewController.identifier = @"Advanced";
  advancedViewController.toolbarItemImage = [NSImage imageNamed:NSImageNameAdvanced];
  advancedViewController.toolbarItemLabel = @"Advanced";

  NSArray *controllers = @[generalViewController, gpgViewController, advancedViewController];

  for (NSViewController *viewController in controllers) {
    [(YOView *)[viewController view] layoutView];
  }

  /*
  _preferencesWindowController = [[MASPreferencesWindowController alloc] initWithViewControllers:controllers title:@"Preferences"];

  [[sender window] kb_addChildWindow:_preferencesWindowController.window rect:CGRectMake(0, 0, 600, 400) position:KBWindowPositionCenter];
  [_preferencesWindowController.window makeKeyAndOrderFront:nil];
   */
}

- (void)close {
  //[_preferencesWindowController close];
}

- (void)saveConfig {

}

- (id)valueForIdentifier:(NSString *)identifier {
//  if ([identifier isEqualTo:@"Preferences.GPGEnabled"]) {
//    return @(![_config[@"gpg-disabled"] boolValue]);
//  }

  if ([identifier gh_startsWith:@"Preferences."]) {
    return [_userDefaults objectForKey:identifier];
  } else {
//    NSAssert(_config, @"No config");
//    return _config[identifier];
    return nil;
  }
}

- (void)setValue:(id)value forIdentifier:(NSString *)identifier synchronize:(BOOL)synchronize {

  // Convert preferences
//  if ([identifier isEqualTo:@"Preferences.GPGEnabled"]) {
//    identifier = @"gpg-disabled";
//    value = @(![value boolValue]);
//  }

  if ([identifier gh_startsWith:@"Preferences."]) {
    DDLogDebug(@"Setting (local) %@=%@", identifier, value);
    [_userDefaults setObject:value forKey:identifier];
    if (synchronize) [_userDefaults synchronize];
  } else {
//    DDLogDebug(@"Setting %@=%@", identifier, value);
//    _config[identifier] = value;
//    if (synchronize) [self saveConfig];
  }
}

@end
