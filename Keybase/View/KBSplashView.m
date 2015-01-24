//
//  KBSplashView.m
//  Keybase
//
//  Created by Gabriel on 1/13/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBSplashView.h"
#import "KBLookAndFeel.h"
#import <Slash/Slash.h>

@interface KBSplashView ()
@property KBLabel *titleLabel;
@property KBLabel *descLabel;
@property NSMutableArray *controls;
@end

@implementation KBSplashView

- (void)viewInit {
  [super viewInit];

  _titleLabel = [[KBLabel alloc] init];
  [self addSubview:_titleLabel];

  _descLabel = [[KBLabel alloc] init];
  [self addSubview:_descLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 60;

    y += [layout setFrame:CGRectMake(0, y, size.width, 80) view:yself.titleLabel].size.height;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.descLabel].size.height + 30;

    for (NSControl *control in yself.controls) {
      y += [layout setOrigin:CGPointMake(size.width/2.0f - control.frame.size.width/2.0, y) view:control].size.height;
    }
    return size;
  }];
}

- (void)setTitle:(NSString *)title message:(NSString *)message {
  [self setTitle:title message:message messageFont:nil];
}

- (void)setTitle:(NSString *)title message:(NSString *)message messageFont:(NSFont *)messageFont {
  [_titleLabel setText:title font:[NSFont fontWithName:@"HelveticaNeue-Thin" size:48] color:[NSColor blackColor] alignment:NSCenterTextAlignment];

  if (!messageFont) messageFont = [NSFont systemFontOfSize:20];
  NSDictionary *style = @{@"$default": @{NSFontAttributeName: messageFont},
                          @"strong": @{NSFontAttributeName: [NSFont boldSystemFontOfSize:messageFont.pointSize]},};

  NSMutableParagraphStyle *pstyle = [[NSParagraphStyle defaultParagraphStyle] mutableCopy];
  [pstyle setAlignment:NSCenterTextAlignment];

  NSMutableAttributedString *s = [[SLSMarkupParser attributedStringWithMarkup:message style:style error:NULL] mutableCopy];
  [s addAttribute:NSParagraphStyleAttributeName value:pstyle range:NSMakeRange(0, [s length])];
  [s addAttribute:NSForegroundColorAttributeName value:[KBLookAndFeel secondaryTextColor] range:NSMakeRange(0, [s length])];

  _descLabel.attributedText = s;
  [self setNeedsLayout];
}

- (void)addButtonWithTitle:(NSString *)title target:(dispatch_block_t)target {
  [self addButtonWithTitle:title size:CGSizeMake(300, 56) target:target];
}

- (void)addButtonWithTitle:(NSString *)title size:(CGSize)size target:(dispatch_block_t)target {
  KBButton *button = [[KBButton alloc] initWithFrame:CGRectMake(0, 0, size.width, size.height)];
  //button.borderColor = [KBLookAndFeel selectColor];
  //button.cornerRadius = 4;
  //button.font = [NSFont systemFontOfSize:16];
  [button setText:title font:[KBLookAndFeel buttonFont] color:[KBLookAndFeel textColor] alignment:NSCenterTextAlignment];
  button.targetBlock = ^(id sender) {
    target();
  };
  [self addButton:button];
}

- (void)addLinkButtonWithTitle:(NSString *)title target:(dispatch_block_t)target {
  KBButton *b = [KBButton buttonWithLinkText:title];
  b.targetBlock = target;
  b.alignment = NSCenterTextAlignment;
  b.frame = CGRectMake(0, 0, 300, 56);
  [self addButton:b];
}

- (void)addButton:(KBButton *)button {
  if (!_controls) _controls = [NSMutableArray array];
  [_controls addObject:button];
  [self addSubview:button];
  [self setNeedsLayout];
}

@end
