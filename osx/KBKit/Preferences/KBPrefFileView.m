//
//  KBPrefFileView.m
//  Keybase
//
//  Created by Gabriel on 4/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPrefFileView.h"
#import <Tikppa/Tikppa.h>

@interface KBPrefFileView ()
@property KBLabel *label;
@property NSTextField *textField;
@property KBButton *browseButton;
@property id<KBPreferences> preferences;
@end

@implementation KBPrefFileView

- (void)viewInit {
  [super viewInit];

  _label = [KBLabel label];
  [self addSubview:_label];

  _textField = [[NSTextField alloc] init];
  _textField.focusRingType = NSFocusRingTypeNone;
  //_textField.editable = NO;
  //_textField.selectable = YES;
  _textField.font = KBAppearance.currentAppearance.textFont;
  _textField.lineBreakMode = NSLineBreakByTruncatingHead;
  [self addSubview:_textField];

  GHWeakSelf gself = self;
  _browseButton = [KBButton buttonWithText:@"Browse" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
  _browseButton.targetBlock = ^{ [gself chooseInput]; };
  [self addSubview:_browseButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 0;
    CGFloat y = 0;
    x += [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 6, 100, 0) view:yself.label].size.width + 10;

    [layout sizeToFitVerticalInFrame:CGRectMake(x, y + 2, size.width - x - 90, 0) view:yself.textField];

    y += [layout sizeToFitVerticalInFrame:CGRectMake(size.width - 80, y, 80, 0) view:yself.browseButton].size.height;

    //y += [layout sizeToFitVerticalInFrame:CGRectMake(x + 5, y, size.width - x - 20, 0) view:yself.infoLabel].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setLabelText:(NSString *)labelText identifier:(NSString *)identifier preferences:(id<KBPreferences>)preferences {
  self.identifier = identifier;
  self.preferences = preferences;
  [_label setText:labelText style:KBTextStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
  NSString *path = [self.preferences valueForIdentifier:self.identifier];
  _textField.stringValue = path ? path : @"";
  [self setNeedsLayout];
}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  panel.allowsMultipleSelection = NO;
  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      for (NSURL *URL in [panel URLs]) {
        if ([URL isFileURL]) {
          gself.textField.stringValue = URL.path ? URL.path : @"";
        }
      }
    }
  }];
}

@end
