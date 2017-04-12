//
//  KBPrefCheckbox.m
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefCheckbox.h"
#import <Tikppa/Tikppa.h>

@interface KBPrefCheckbox ()
@property KBLabel *categoryLabel; // Optional
@property KBButton *button;
@property id<KBPreferences> preferences;
@end

@implementation KBPrefCheckbox

- (void)viewInit {
  [super viewInit];
  _inset = 140;

  _categoryLabel = [[KBLabel alloc] init];
  [self addSubview:_categoryLabel];

  _button = [KBButton button];
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, yself.inset, 0) view:yself.categoryLabel].size.width + 10;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.button].size.height;
    return CGSizeMake(size.width, y);
  }];
}

- (void)dealloc {
  [_button removeObserver:self forKeyPath:@"cell.state"];
}

- (void)setCategory:(NSString *)category {
  [_categoryLabel setText:category style:KBTextStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
}

- (void)setLabelText:(NSString *)labelText identifier:(NSString *)identifier preferences:(id<KBPreferences>)preferences {
  self.identifier = identifier;
  self.preferences = preferences;
  [_button setText:labelText style:KBButtonStyleCheckbox alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];

  _button.state = [[self.preferences valueForIdentifier:identifier] boolValue] ? NSOnState : NSOffState;
  [_button addObserver:self forKeyPath:@"cell.state" options:(NSKeyValueObservingOptionNew | NSKeyValueObservingOptionOld) context:NULL];

  [self setNeedsLayout];
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context {
  BOOL value = [(NSButton *)object state] == NSOnState;
  [self.preferences setValue:@(value) forIdentifier:self.identifier synchronize:YES];
}

@end
