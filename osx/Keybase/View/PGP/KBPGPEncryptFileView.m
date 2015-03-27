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
#import "KBFileSelectView.h"

@interface KBPGPEncryptFileView ()
@property KBUserPickerView *userPickerView;
@property KBFileSelectView *inputSelectView;
@property KBFileSelectView *outputSelectView;
@property KBPGPEncryptFooterView *footerView;

@property KBPGPEncrypt *encrypter;
@end

@implementation KBPGPEncryptFileView

- (void)viewInit {
  [super viewInit];

  YOVBox *contentView = [YOVBox box];
  [self addSubview:contentView];
  _userPickerView = [[KBUserPickerView alloc] init];
  _userPickerView.delegate = self;
  [contentView addSubview:_userPickerView];
  [contentView addSubview:[KBBox horizontalLine]];

  GHWeakSelf gself = self;

  _inputSelectView = [[KBFileSelectView alloc] init];
  [_inputSelectView.label setText:@"File" font:[NSFont systemFontOfSize:16] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment];
  _inputSelectView.browseButton.targetBlock = ^{ [gself chooseInput]; };
  [contentView addSubview:_inputSelectView];
  [contentView addSubview:[KBBox horizontalLine]];

  _outputSelectView = [[KBFileSelectView alloc] init];
  [_outputSelectView.label setText:@"Save as" font:[NSFont systemFontOfSize:16] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment];
  _outputSelectView.browseButton.targetBlock = ^{ [gself chooseOutput]; };
  [contentView addSubview:_outputSelectView];

  _footerView = [[KBPGPEncryptFooterView alloc] init];
  _footerView.encryptButton.targetBlock = ^{ [gself encrypt]; };
  _footerView.signButton.state = NSOnState;
  _footerView.includeSelfButton.state = NSOnState;
  [contentView addSubview:_footerView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts vertical:self.subviews]];

  // Search results from picker view is here so we can float it
  [self addSubview:_userPickerView.searchResultsView];
}

- (void)layout {
  [super layout];
  CGFloat y2 = CGRectGetMaxY(self.userPickerView.frame);
  CGSize size = self.frame.size;
  _userPickerView.searchResultsView.frame = CGRectMake(40, y2, size.width - 40, size.height - y2);
}

- (void)encrypt {
  NSString *inPath = _inputSelectView.textField.text;
  NSString *outPath = _outputSelectView.textField.text;
  KBFileReader *reader = [KBFileReader fileReaderWithPath:inPath];
  if (!reader) {
    [self.navigation setError:KBMakeError(-1, @"Unable to open file: %@", inPath) sender:self];
    return;
  }
  KBFileWriter *writer = [KBFileWriter fileWriterWithPath:outPath];

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
  self.inputSelectView.textField.text = inputPath;
  if (updateOutputDefault) {
    self.outputSelectView.textField.text = NSStringWithFormat(@"%@.gpg", inputPath);
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

  if ([self.outputSelectView.textField.text gh_isPresent]) {
    NSString *path = self.outputSelectView.textField.text;
    panel.nameFieldStringValue = [path lastPathComponent];
    panel.directoryURL = [NSURL fileURLWithPath:[path stringByDeletingLastPathComponent] isDirectory:YES];
  }

  GHWeakSelf gself = self;
  [panel beginSheetModalForWindow:self.window completionHandler:^(NSInteger result) {
    if (result == NSFileHandlingPanelOKButton) {
      NSURL *URL = [panel URL];
      if ([URL isFileURL]) gself.outputSelectView.textField.text = URL.path;
    }
  }];
}

- (void)userPickerViewDidUpdate:(KBUserPickerView *)userPickerView {
  CGSize size = userPickerView.frame.size;
  CGSize sizeThatFits = [userPickerView sizeThatFits:self.frame.size];
  if (sizeThatFits.height > size.height) {
    [self layoutView];
  }
}

@end
