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

@interface KBPGPEncryptFileView ()
@property KBTextField *inputFileView;
@property KBTextField *outputFileView;

@property KBPGPEncrypt *encrypter;
@end

@implementation KBPGPEncryptFileView

- (void)viewInit {
  [super viewInit];

  KBLabel *inputLabel = [KBLabel labelWithText:@"Source" style:KBLabelStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
  inputLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:inputLabel];
  _inputFileView = [[KBTextField alloc] init];
  _inputFileView.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _inputFileView.textField.font = [NSFont systemFontOfSize:14];
  [self addSubview:_inputFileView];
  KBButton *browseInput = [KBButton buttonWithText:@"Browse" style:KBButtonStyleToolbar];
  browseInput.targetBlock = ^{ [self chooseInput]; };
  [self addSubview:browseInput];

  KBLabel *outputLabel = [KBLabel labelWithText:@"Destination" style:KBLabelStyleDefault alignment:NSRightTextAlignment lineBreakMode:NSLineBreakByClipping];
  outputLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:outputLabel];
  _outputFileView = [[KBTextField alloc] init];
  _outputFileView.textField.lineBreakMode = NSLineBreakByTruncatingHead;
  _outputFileView.textField.font = [NSFont systemFontOfSize:14];
  [self addSubview:_outputFileView];
  KBButton *browseOutput = [KBButton buttonWithText:@"Browse" style:KBButtonStyleToolbar];
  browseOutput.targetBlock = ^{ [self chooseOutput]; };
  [self addSubview:browseOutput];

  YOHBox *footerView = [YOHBox box:@{@"spacing": @(10), @"minSize": @"130,0", @"horizontalAlignment": @"right"}];
  KBButton *cancelButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault];
  cancelButton.targetBlock = ^{ [[self window] close]; };
  [footerView addSubview:cancelButton];
  KBButton *button = [KBButton buttonWithText:@"Encrypt" style:KBButtonStylePrimary];
  button.targetBlock = ^{ [self encrypt]; };
  [footerView addSubview:button];
  [self addSubview:footerView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
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

    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width - 20, 0) view:footerView].size.height + 20;

    return CGSizeMake(size.width, y);
  }];
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
  options.recipients = @[];
  options.binaryOut = YES;
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

@end
