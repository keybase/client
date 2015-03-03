//
//  KBLayouts.h
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBLayouts : NSObject

+ (YOLayoutBlock)borderLayoutWithCenterView:(id)centerView topView:(id)topView bottomView:(id)bottomView margin:(UIEdgeInsets)margin padding:(CGFloat)padding maxSize:(CGSize)maxSize;

+ (YOLayoutBlock)gridLayoutForViews:(NSArray *)views viewSize:(CGSize)viewSize padding:(CGFloat)padding;

+ (YOLayoutBlock)center:(id)view;

@end
