//
//  KBView.h
//  Keybase
//
//  Created by Gabriel on 3/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

typedef NS_ENUM(NSInteger, KBVerticalAlignment) {
  KBVerticalAlignmentNone,
  KBVerticalAlignmentTop,
  KBVerticalAlignmentMiddle,
  KBVerticalAlignmentBottom,
  KBVerticalAlignmentBaseline,
};

typedef NS_ENUM(NSInteger, KBHorizontalAlignment) {
  KBHorizontalAlignmentLeft,
  KBHorizontalAlignmentCenter,
  KBHorizontalAlignmentRight
};

@interface KBView : YONSView

@property BOOL clipToBounds; // Writable alias for wantsDefaultClipping
@property (nonatomic) NSColor *backgroundColor;

@end