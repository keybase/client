//
//  KBConnectWindowController.m
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBConnectWindowController.h"
#import "KBDefines.h"

#import "GRNavigationController.h"
#import "KBLoginViewController.h"
#import "KBKeyGenViewController.h"

@interface KBConnectWindowController ()
@end

@implementation KBConnectWindowController

- (id)init {
  return [super initWithWindowNibName:@"KBConnect"];
}

- (void)windowDidLoad {
  self.window.backgroundColor = NSColor.whiteColor;
  
  KBLoginViewController *loginViewController = [[KBLoginViewController alloc] init];
  self.navigationController.rootViewController = loginViewController;
  
  [self.window setContentSize:loginViewController.view.frame.size];
  [self.window center];
  
  [self.navigationController setupRootViewController];
}

@end
