//
//  KBConnectWindowController.h
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import <Cocoa/Cocoa.h>

#import "GRNavigationController.h"

@interface KBConnectWindowController : NSWindowController

@property (strong) IBOutlet NSWindow *window;

@property IBOutlet GRNavigationController *navigationController;

@end
