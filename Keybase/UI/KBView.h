//
//  KBView.h
//  Keybase
//
//  Created by Gabriel on 1/8/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import "KBDefines.h"
#import <YOLayout/YONSView.h>

@class KBNavigationView;

@interface KBView : YONSView

@property KBNavigationView *navigation;
@property (readonly) KBErrorBlock errorHandler;

@property (nonatomic) BOOL progressIndicatorEnabled;

- (void)setInProgress:(BOOL)inProgress sender:(NSView *)sender;

- (void)setError:(NSError *)error;
- (void)setError:(NSError *)error sender:(NSView *)sender;

- (void)viewWillAppearInView:(NSView *)view animated:(BOOL)animated;

- (void)setBackgroundColor:(NSColor *)backgroundColor;

@end
