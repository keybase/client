//
//  KBNavigationController.h
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

@import Cocoa;
@import QuartzCore;

#import <YOLayout/YOLayout.h>

@interface KBNavigationController : NSViewController

@property (nonatomic, strong) CATransition *transition;

@property (nonatomic) NSView *titleView;
@property (nonatomic) NSView *rootView;

- (void)pushView:(NSView *)view animated:(BOOL)animated;

- (void)popViewAnimated:(BOOL)animated;

- (void)pushView:(NSView *)view transition:(CATransition *)transition transactionBlock:(void(^)())transactionBlock;

@end
