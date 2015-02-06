//
//  KBMainView.h
//  Keybase
//
//  Created by Gabriel on 2/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"

@interface KBMainView : YONSView <NSSplitViewDelegate, NSWindowDelegate> //, NSWindowRestoration>

- (NSWindow *)createWindow;

@end
