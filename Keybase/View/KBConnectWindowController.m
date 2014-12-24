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

@interface KBConnectWindowController ()
@property IBOutlet GRNavigationController *navigationController;
@end

@implementation KBConnectWindowController

- (id)init {
  return [super initWithWindowNibName:@"KBConnect"];
}

- (void)windowDidLoad {
  self.window.backgroundColor = NSColor.whiteColor;
  
  KBLoginViewController *loginViewController = [[KBLoginViewController alloc] initWithNibName:@"KBLogin" bundle:nil];
  self.navigationController.rootViewController = loginViewController;
  
  [self.window setContentSize:loginViewController.view.frame.size];
  
  [self.navigationController setupRootViewController];
}

@end
