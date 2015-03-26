//
//  KBPGPEncryptFileView.m
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPGPEncryptFileView.h"
#import "KBPGPEncrypt.h"
#import "KBFileReader.h"
#import "KBFileWriter.h"
#import "KBPGPEncryptFooterView.h"

@interface KBPGPEncryptFileView ()
@property KBUserPickerView *userPickerView;
@property KBTextField *inputFileView;
@property KBTextField *outputFileView;
@property KBPGPEncryptFooterView *footerView;

@property KBPGPEncrypt *encrypter;
@end

@implementation KBPGPEncryptFileView

- (void)viewInit {
  [super viewInit];

  YOVBox *topView = [YOVBox box];
  [self addSubview:topView];
  _userPickerView = [[KBUserPickerView alloc] init];
  _userPickerView.delegate = self;
  [topView addSubview:_userPickerView];
  [topView addSubview:[KBBox horizontalLine]];

  YOView *contentView = [YOView view];

  KBLabel *inputLabel = [KBLabel labelWithText:@"Source" style:KBLabelStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
  inputLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [contentView addSubview:inputLabel];
  _inputFileView = [[KBTextField alloc] init];
  _inputFileView.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _inputFileView.textField.font = [NSFont systemFontOfSize:14];
  [contentView addSubview:_inputFileView];
  KBButton *browseInput = [KBButton buttonWithText:@"Browse" style:KBButtonStyleToolbar];
  browseInput.targetBlock = ^{ [self chooseInput]; };
  [contentView addSubview:browseInput];

  KBLabel *outputLabel = [KBLabel labelWithText:@"Destination" style:KBLabelStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
  outputLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [contentView addSubview:outputLabel];
  _outputFileView = [[KBTextField alloc] init];
  _outputFileView.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _outputFileView.textField.font = [NSFont systemFontOfSize:14];
  [contentView addSubview:_outputFileView];
  KBButton *browseOutput = [KBButton buttonWithText:@"Browse" style:KBButtonStyleToolbar];
  browseOutput.targetBlock = ^{ [self chooseOutput]; };
  [contentView addSubview:browseOutput];
  [self addSubview:contentView];

  GHWeakSelf gself = self;
  _footerView = [[KBPGPEncryptFooterView alloc] init];
  _footerView.encryptButton.targetBlock = ^{ [gself encrypt]; };
  _footerView.signButton.state = NSOnState;
  _footerView.includeSelfButton.state = NSOnState;
  [self addSubview:_footerView];

  YOSelf yself = self;
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat x = 20;
    CGFloat y = 20;
    CGFloat col1 = 100;
    x += [layout setFrame:CGRectMake(x, y, col1, 32) view:inputLabel].size.width + 10;
    x += [layout setFrame:CGRectMake(x, y + 7, size.width - x - 150, 25) view:yself.inputFileView].size.width + 20;
    x += [layout setFrame:CGRectMake(x, y + 3, 100, 26) view:browseInput].size.width;

    x = 10;
    y += 32 + 10;

    x += [layout setFrame:CGRectMake(x, y, col1, 32) view:outputLabel].size.width + 10;
    x += [layout setFrame:CGRectMake(x, y + 7, size.width - x - 150, 25) view:yself.outputFileView].size.width + 20;
    x += [layout setFrame:CGRectMake(x, y + 3, 100, 26) view:browseOutput].size.width;
    y += 32;

    y += 40;

    return CGSizeMake(size.width, y);
  }];

  // Search results from picker view is here so we can float it
  [self addSubview:_userPickerView.searchResultsView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts borderLayoutWithCenterView:contentView topView:topView bottomView:_footerView insets:UIEdgeInsetsZero spacing:0 maxSize:CGSizeMake(600, 450)]];
}

- (void)encrypt {
  KBFileReader *reader = [KBFileReader fileReaderWithPath:_inputFileView.text];
  if (!reader) {
    [self.navigation setError:KBMakeError(-1, @"Unable to open file: %@", _inputFileView.text) sender:self];
    return;
  }
  KBFileWriter *writer = [KBFileWriter fileWriterWithPath:_outputFileView.text];

  _encrypter = [[KBPGPEncrypt alloc] init];
  KBRPgpEncryptOptions *options = [[KBRPgpEncryptOptions alloc] init];
  options.binaryOut = YES;
  options.recipients = _userPickerView.usernames;
  options.noSelf = _footerView.includeSelfButton.state != NSOnState;
  options.noSign = _footerView.signButton.state != NSOnState;
  self.navigation.progressEnabled = YES;
  [_encrypter encryptWithOptions:options reader:reader writer:writer client:self.client sender:self completion:^(NSError *error) {
    self.navigation.progressEnabled = NO;
    if ([self.navigation setError:error sender:self]) return;

    
  }];
}

- (void)chooseInput {
  NSOpenPanel *panel = [NSOpenPanel openPanel];
  panel.prompt = @"OK";
  panel.title = @"Choose a file...";
  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      NSURL *URL = [panel URL];
      if ([URL isFileURL]) {
        [gself setInputPath:URL.path updateOutputDefault:YES];
      }
    }
  }];
}

- (void)setInputPath:(NSString *)inputPath updateOutputDefault:(BOOL)updateOutputDefault {
  self.inputFileView.text = inputPath;
  if (updateOutputDefault) {
    self.outputFileView.text = NSStringWithFormat(@"%@.gpg", inputPath);
  }
}

- (void)chooseOutput {
  NSSavePanel *panel = [NSSavePanel savePanel];
  panel.prompt = @"OK";
  panel.title = @"Destination";
  panel.allowedFileTypes = @[@"gpg"];
  panel.allowsOtherFileTypes = YES;
  panel.canCreateDirectories = YES;
  panel.canSelectHiddenExtension = YES;

  if ([self.outputFileView.text gh_isPresent]) {
    NSString *path = self.outputFileView.text;
    panel.nameFieldStringValue = [path lastPathComponent];
    panel.directoryURL = [NSURL fileURLWithPath:[path stringByDeletingLastPathComponent] isDirectory:YES];
  }

  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      NSURL *URL = [panel URL];
      if ([URL isFileURL]) gself.outputFileView.text = URL.path;
    }
  }];
}

- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView {
  
}

@end
