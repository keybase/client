//
//  KBViews.h
//  Keybase
//
//  Created by Gabriel on 3/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <YOLayout/YOLayout.h>

@interface KBViews : YONSView

- (void)setViews:(NSArray *)views;

- (void)showViewWithIdentifier:(NSString *)identifier;

- (NSString *)visibleIdentifier;

@end
