//
//  KBPrefPopUpView.m
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefPopUpView.h"

@interface KBPrefPopUpView ()
@property KBLabel *label;
@property NSButton *button;
@property KBLabel *infoLabel;
@end

@implementation KBPrefPopUpView

- (void)viewInit {
  [super viewInit];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _button = [[NSPopUpButton alloc] initWithFrame:CGRectMake(0, 0, 320, 23) pullsDown:YES];
  _button.font = [NSFont systemFontOfSize:14];
  [self addSubview:_button];

//  _infoLabel = [[KBLabel alloc] init];
//  [self addSubview:_infoLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 3, 100, 0) view:yself.label].size.width + 10;

    y += [layout setFrame:CGRectMake(x, y, size.width - x - 20, 25) view:yself.button].size.height;

    //y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x - 20, 0) view:yself.infoLabel].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setLabelText:(NSString *)labelText options:(NSArray *)options identifier:(NSString *)identifier {
  self.identifier = identifier;

  [_label setText:labelText style:KBTextStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
  //[_infoLabel setText:infoText style:KBTextStyleSecondaryText alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  NSMenu *menu = [[NSMenu alloc] init];
  [menu addItemWithTitle:@"" action:NULL keyEquivalent:@""];
  for (NSString *option in options) {
    NSMenuItem *item = [menu addItemWithTitle:option action:@selector(option:) keyEquivalent:@""];
    item.target = self;
  }
  [_button setMenu:menu];

  NSString *title = [self.preferences valueForIdentifier:self.identifier];
  _button.title = title ? title : @"";
}

- (void)option:(NSMenuItem *)item {
  [_button setTitle:item.title];
  [self.preferences setValue:item.title forIdentifier:self.identifier synchronize:YES];
}

@end
