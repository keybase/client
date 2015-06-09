//
//  KBLayouts.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

#import <KBAppKit/KBAppKit.h>

@interface KBLayouts : NSObject

+ (YOLayoutBlock)borderLayoutWithCenterView:(id)centerView leftView:(id)leftView rightView:(id)rightView insets:(UIEdgeInsets)insets spacing:(CGFloat)spacing;

+ (YOLayoutBlock)gridLayoutForViews:(NSArray *)views viewSize:(CGSize)viewSize padding:(CGFloat)padding;

+ (YOLayoutBlock)vertical:(NSArray *)subviews;

@end
