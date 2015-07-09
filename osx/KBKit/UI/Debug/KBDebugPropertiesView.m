//
//  KBDebugPropertiesView.m
//  Keybase
//
//  Created by Gabriel on 5/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDebugPropertiesView.h"

#import "KBHeaderLabelView.h"

@interface KBDebugPropertiesView ()
@property NSView *view;
@end

@implementation KBDebugPropertiesView

- (void)setProperties:(GHODictionary *)properties {
  NSView *view = [KBDebugPropertiesView viewForProperties:properties];
  [_view removeFromSuperview];
  _view = view;
  [self addSubview:_view];
  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    return [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, size.height) view:yself.view].size;
  }];
  [self setNeedsLayout];
}

+ (NSView *)viewForProperties:(GHODictionary *)properties {
  YOVBox *view = [YOVBox box:@{@"spacing": @(10), @"insets": @"10,0,10,0"}];
  [view kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  typedef NSView * (^KBCreateInfoLabel)(NSString *key, NSString *value);

  KBCreateInfoLabel createView = ^NSView *(NSString *key, NSString *value) {
    KBHeaderLabelView *view = [KBHeaderLabelView headerLabelViewWithHeader:key headerOptions:0 text:value style:KBTextStyleDefault options:0 lineBreakMode:NSLineBreakByCharWrapping];
    view.columnWidth = 120;
    return view;
  };

  for (id key in properties) {
    id value = properties[key];

    if (value == (void*)kCFBooleanTrue) value = @"Yes";
    else if (value == (void*)kCFBooleanFalse) value = @"No";
    else if ([value isEqualTo:NSNull.null]) value = @"-";

    if ([value isKindOfClass:NSString.class]) {
      [view addSubview:createView(key, value)];
    } else {
      [view addSubview:createView(key, [value description])];
    }
  }

  return view;
}

@end
