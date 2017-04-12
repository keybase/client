//
//  KBPrefPopUpView.m
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefPopUpView.h"

#import "KBPrefOption.h"
#import <Tikppa/Tikppa.h>

@interface KBPrefPopUpView ()
@property KBLabel *label;
@property NSPopUpButton *button;
@property KBLabel *infoLabel;
@property id<KBPreferences> preferences;
@end

@implementation KBPrefPopUpView

- (void)viewInit {
  [super viewInit];
  _inset = 150;
  _labelWidth = 0;
  _fieldWidth = 300;

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _button = [[NSPopUpButton alloc] init];
  _button.pullsDown = YES;
  _button.font = [NSFont systemFontOfSize:14];
  [self addSubview:_button];

//  _infoLabel = [[KBLabel alloc] init];
//  [self addSubview:_infoLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = yself.inset;
    CGFloat y = 0;
    if (yself.labelWidth > 0) {
      x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 3, yself.labelWidth, 0) view:yself.label].size.width + 10;
    } else {
      x += [layout sizeToFitInFrame:CGRectMake(x, y + 3, size.width - x, 0) view:yself.label].size.width + 5;
    }

    y += [layout setFrame:CGRectMake(x, y, MIN(size.width - x - 20, yself.fieldWidth), 25) view:yself.button].size.height;

    //y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.infoLabel].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setLabelText:(NSString *)labelText options:(NSArray *)options identifier:(NSString *)identifier preferences:(id<KBPreferences>)preferences {
  self.identifier = identifier;
  self.preferences = preferences;

  [_label setText:labelText style:KBTextStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
  //[_infoLabel setText:infoText style:KBTextStyleSecondaryText alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  id selectedValue = [self.preferences valueForIdentifier:self.identifier];

  NSString *selectedTitle = nil;
  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"" action:NULL keyEquivalent:@""];
  for (KBPrefOption *option in options) {
    NSMenuItem *item = [menu addItemWithTitle:option.label action:@selector(option:) keyEquivalent:@""];
    item.representedObject = option.value;
    item.target = self;
    if ([selectedValue isEqualTo:option.value]) selectedTitle = option.label;
  }
  [_button setMenu:menu];

  _button.title = selectedTitle ? selectedTitle : @"";
}

- (void)option:(NSMenuItem *)item {
  [_button setTitle:item.title];
  [self.preferences setValue:item.representedObject forIdentifier:self.identifier synchronize:YES];
}

@end
