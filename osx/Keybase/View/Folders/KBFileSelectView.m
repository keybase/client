//
//  KBFileSelectView.m
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileSelectView.h"

@interface KBFileSelectView ()
@property KBLabel *label;
@property KBTextField *textField;
@property KBButton *browseButton;
@end

@implementation KBFileSelectView

- (void)viewInit {
  [super viewInit];
  [self setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _label = [KBLabel label];
  _label.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_label];

  _textField = [[KBTextField alloc] init];
  _textField.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _textField.textField.font = [NSFont systemFontOfSize:16];
  _textField.focusView.hidden = YES;
  [self addSubview:_textField];

  GHWeakSelf gself = self;
  _browseButton = [KBButton buttonWithText:@"Browse" style:KBButtonStyleToolbar];
  _browseButton.targetBlock = ^{ [gself chooseInput]; };
  [self addSubview:_browseButton];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:_textField leftView:_label rightView:_browseButton insets:UIEdgeInsetsMake(10, 10, 10, 10) spacing:10]];
}

- (NSString *)path {
  return _textField.text;
}

- (void)setLabelText:(NSString *)labelText {
  [_label setText:labelText font:[NSFont systemFontOfSize:16] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment];
  [self setNeedsLayout];
}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  panel.allowsMultipleSelection = YES;
  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      for (NSURL *URL in [panel URLs]) {
        if ([URL isFileURL]) {
          gself.textField.text = URL.path;
        }
      }
    }
  }];
}

@end
