//
//  KBNavigationController.h
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

@import Cocoa;
@import QuartzCore;


@interface KBNavigationController : NSViewController

@property (nonatomic) NSView *rootView;

@property (nonatomic, strong) CATransition *transition;

- (void)pushView:(NSView *)view animated:(BOOL)animated;

- (void)popViewAnimated:(BOOL)animated;

- (void)pushView:(NSView *)view transition:(CATransition *)transition transactionBlock:(void(^)())transactionBlock;

@end