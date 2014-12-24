//
//  GRViewController.h
//  Navigation
//
//  Created by Guilherme Rambo on 19/05/14.
//  Copyright (c) 2014 Guilherme Rambo. All rights reserved.
//

@import Cocoa;

@class CATransition;
#import "GRNavigationController.h"

/*!
 GRViewController is an abstract class, subclassed from NSViewController, which can be used inside GRNavigationControllers.
 You use It just like a regular NSViewController but there are some additional methods you can override to control it's behavior on the navigation stack.
 */
@interface GRViewController : NSViewController

/**
 @property navigationController
 @abstract A pointer to the navigation controller this view controller is in.
 @discussion
 Note: this is only set when the view controller is on the navigation controller's stack!
 */
@property (nonatomic, readonly) GRNavigationController *navigationController;

/**
 The transition that should be used when this view controller is popped from the stack
 */
@property (nonatomic, strong) CATransition *rewindTransition;

#pragma mark Override the methods below to taste

/**
 @method viewDidLoad
 @abstract Sent right after awakeFromNib
 @note You don't have to call super
 */
- (void)viewDidLoad;

/**
 @method viewWillAppear:
 @abstract Sent when the view is about to appear
 @note Any animations done inside this method will be grouped with the navigation animation
 @note You don't have to call super
 */
- (void)viewWillAppear:(BOOL)animated;

/**
 @method viewDidAppear:
 @abstract Sent when the view has just appeared
 @note You don't have to call super
 */
- (void)viewDidAppear:(BOOL)animated;

/**
 @method viewWillDisappear:
 @abstract Sent when the view is about to disappear
 @note Any animations done inside this method will be grouped with the navigation animation
 @note You don't have to call super
 */
- (void)viewWillDisappear:(BOOL)animated;

/**
 @method viewDidDisappear:
 @abstract Sent when the view has just disappeared
 @note You don't have to call super
 */
- (void)viewDidDisappear:(BOOL)animated;

@end