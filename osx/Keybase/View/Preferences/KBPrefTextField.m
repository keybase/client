//
//  KBPrefTextField.m
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefTextField.h"

@interface KBPrefTextField ()
@property KBLabel *label;
@property NSTextField *textField;
@property KBLabel *infoLabel;
@property id<KBPreferences> preferences;
@end

@implementation KBPrefTextField

- (void)viewInit {
  [super viewInit];
  _inset = 140;
  _fieldWidth = 300;

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _textField = [[NSTextField alloc] init];
  _textField.focusRingType = NSFocusRingTypeNone;
  _textField.font = KBAppearance.currentAppearance.textFont;
  _textField.lineBreakMode = NSLineBreakByTruncatingHead;
  [self addSubview:_textField];

  _infoLabel = [[KBLabel alloc] init];
  [self addSubview:_infoLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 2, yself.inset, 0) view:yself.label].size.width + 10;

    CGFloat fieldWidth = MIN(size.width - x - 20, yself.fieldWidth);
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, fieldWidth, 0) view:yself.textField].size.height + 2;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x + 5, y, size.width - x - 20, 0) view:yself.infoLabel].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setLabelText:(NSString *)labelText infoText:(NSString *)infoText identifier:(NSString *)identifier preferences:(id<KBPreferences>)preferences {
  self.identifier = identifier;
  self.preferences = preferences;
  [_label setText:labelText style:KBTextStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
  [_infoLabel setText:infoText font:KBAppearance.currentAppearance.smallTextFont color:KBAppearance.currentAppearance.secondaryTextColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  NSString *value = [self.preferences valueForIdentifier:identifier];
  _textField.stringValue = value ? value : @"";

  [self setNeedsLayout];
}

@end
