//
//  GRNavigationController.h
//  Navigation
//
//  Created by Guilherme Rambo on 19/05/14.
//  Copyright (c) 2014 Guilherme Rambo. All rights reserved.
//

@import Cocoa;
@import QuartzCore;

@class GRViewController;

/*!
 GRNavigationController manages a stack of GRViewControllers.
 
 Controllers can be pushed and popped with animated transitions.
 */

@interface GRNavigationController : NSViewController

/**
 The view controller added to the stack immediately
 after the navigation controller awakes
 */
@property (nonatomic, weak) IBOutlet GRViewController *rootViewController;

/**
 An outlet to the button to use as the "back" button
 */
@property (nonatomic, weak) IBOutlet id backButton;

/**
 Returns an array of GRViewControllers containing
 the view controllers currently on the stack
 */
@property (nonatomic, readonly) NSArray *viewControllers;

/**
 The transition used to transition between the views,
 the default is a push transition
 */
@property (nonatomic, strong) CATransition *transition;

/**
 Pushes viewController on the top of the stack,
 showing it's view
 */
- (void)pushViewController:(GRViewController *)viewController animated:(BOOL)animated;

/**
 Removes the view controller at the top of the stack,
 hiding it's view
 */
- (void)popViewControllerAnimated:(BOOL)animated;

/**
 @abstract Defines whether the views from the controllers should be resized to the root view's bounds
 @discussion
 This also sets an autoresizing mask on the views
 @note The default is YES
 */
@property (nonatomic, assign) BOOL resizeChildren;

/**
 @abstract Pushes viewController on the top of the stack using transition
 @param viewController
 The view controller to be pushed
 @param transition
 The custom transition you want to use (optional, can be nil)
 @param transactionBlock
 Use this to run other animations during the transition (optional, can be NULL)
 @discussion
 Only use this if you need a very specific animation to be performed during the transition,
 if you just want to transition between two controllers, use pushViewController:animated: instead.
 */
- (void)pushViewController:(GRViewController *)viewController usingTransition:(CATransition *)transition withTransactionBlock:(void(^)())transactionBlock;

- (void)setupRootViewController;

@end