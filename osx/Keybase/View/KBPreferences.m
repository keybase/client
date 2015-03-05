//
//  KBPreferences.m
//  Keybase
//
//  Created by Gabriel on 2/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPreferences.h"

#import "KBAppKit.h"
#import <MASPreferences/MASPreferencesWindowController.h>
#import "AppDelegate.h"

@interface KBPreferences ()
@property MASPreferencesWindowController *preferencesWindowController;
@end

@interface KBPreferencesViewController : NSViewController <MASPreferencesViewController>
@property (nonatomic) NSImage *toolbarItemImage;
@property (nonatomic) NSString *toolbarItemLabel;
@end

@implementation KBPreferencesViewController
@end

@implementation KBPreferences

- (void)open {
  if (!_preferencesWindowController) {
    YONSView *generalView = [[YONSView alloc] initWithFrame:CGRectMake(0, 0, 400, 240)];

    YONSView *advancedView = [[YONSView alloc] initWithFrame:CGRectMake(0, 0, 400, 240)];
    KBButton *recordCheckbox = [KBButton buttonWithText:@"Record RPC Calls" style:KBButtonStyleCheckbox alignment:NSLeftTextAlignment];
    recordCheckbox.identifier = @"Preferences.Advanced.Record";
    recordCheckbox.state = [NSUserDefaults.standardUserDefaults boolForKey:recordCheckbox.identifier];
    [recordCheckbox.cell addObserver:self forKeyPath:@"state" options:(NSKeyValueObservingOptionNew | NSKeyValueObservingOptionOld) context:NULL];
    [advancedView addSubview:recordCheckbox];

//    KBButton *recordOpenButton = [KBButton buttonWithText:@"Open" style:KBButtonStyleDefault];
//    [advancedView addSubview:recordOpenButton];

//    KBButton *catalog = [KBButton buttonWithText:@"Catalog" style:KBButtonStyleLink alignment:NSLeftTextAlignment];
//    catalog.targetBlock = ^{ [AppDelegate.sharedDelegate openCatalog]; };
//    [advancedView addSubview:catalog];

    advancedView.viewLayout = [YOLayout vertical:advancedView.subviews margin:UIEdgeInsetsMake(20, 40, 20, 40) padding:10];
    [advancedView layoutView];

    KBPreferencesViewController *generalViewController = [[KBPreferencesViewController alloc] init];
    generalViewController.view = generalView;
    generalViewController.identifier = @"General";
    generalViewController.toolbarItemImage = [NSImage imageNamed:NSImageNamePreferencesGeneral];
    generalViewController.toolbarItemLabel = @"General";

    KBPreferencesViewController *advancedViewController = [[KBPreferencesViewController alloc] init];
    advancedViewController.view = advancedView;
    advancedViewController.identifier = @"Advanced";
    advancedViewController.toolbarItemImage = [NSImage imageNamed:NSImageNameAdvanced];
    advancedViewController.toolbarItemLabel = @"Advanced";
    NSArray *controllers = [[NSArray alloc] initWithObjects:generalViewController, advancedViewController, nil];

    _preferencesWindowController = [[MASPreferencesWindowController alloc] initWithViewControllers:controllers title:@"Preferences"];
  }
  [_preferencesWindowController.window center];
  [_preferencesWindowController showWindow:nil];
}

- (void)close {
  [_preferencesWindowController close];
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
  [NSUserDefaults.standardUserDefaults setObject:@([object state]) forKey:[object identifier]];
  [NSUserDefaults.standardUserDefaults synchronize];
}

@end
