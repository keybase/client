//
//  KBView.h
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import <YOLayout/YONSView.h>
#import "KBNavigationController.h"

@interface KBView : YONSView

@property KBNavigationController *navigationController;

- (void)setInProgress:(BOOL)inProgress sender:(NSView *)sender;

- (void)setError:(NSError *)error;

@end
