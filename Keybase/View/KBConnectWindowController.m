//
//  KBConnectWindowController.m
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBConnectWindowController.h"
#import "KBDefines.h"

#import "KBLoginView.h"

@interface KBConnectWindowController ()
@end

@implementation KBConnectWindowController

- (void)windowDidLoad {
  self.window.backgroundColor = NSColor.whiteColor;
  
  KBLoginView *loginView = [[KBLoginView alloc] initWithFrame:CGRectMake(0, 0, 320, 480)];
  self.navigationController.rootView = loginView;

  [self.window setContentSize:loginView.frame.size];
  [self.window center];
}

@end
