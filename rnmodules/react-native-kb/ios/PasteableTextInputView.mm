#import "PasteableTextInputView.h"
#import <React/RCTMultilineTextInputView.h>
#import <React/RCTMultilineTextInputViewManager.h>
#import <React/RCTBackedTextInputDelegate.h>
#import <React/RCTBackedTextInputViewProtocol.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#ifdef RCT_NEW_ARCH_ENABLED
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>
#import <react/renderer/components/RNKbSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNKbSpec/EventEmitters.h>
#import <react/renderer/components/RNKbSpec/Props.h>
#import <react/renderer/components/RNKbSpec/RCTComponentViewHelpers.h>

using namespace facebook::react;
#endif

// Custom UITextView that intercepts paste events
@interface PasteableUITextView : UITextView
@property (nonatomic, copy, nullable) RCTDirectEventBlock onPasteImage;
@end

@implementation PasteableUITextView

- (void)paste:(id)sender {
  // Check if pasteboard has image
  UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
  
  BOOL hasImage = NO;
  if (@available(iOS 14.0, *)) {
    hasImage = [pasteboard containsPasteboardTypes:@[UTTypeImage.identifier]];
  } else {
    hasImage = [pasteboard image] != nil;
  }
  
  if (hasImage) {
    [self handleImagePaste];
    return;
  }
  
  // If no image, perform default paste
  [super paste:sender];
}

- (void)handleImagePaste {
  UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
  UIImage *image = [pasteboard image];
  
  if (image == nil) {
    return;
  }
  
  // Save image to temporary directory
  NSString *tempDir = NSTemporaryDirectory();
  NSString *fileName = [NSString stringWithFormat:@"paste_image_%f.jpg", [[NSDate date] timeIntervalSince1970]];
  NSString *filePath = [tempDir stringByAppendingPathComponent:fileName];
  
  NSData *imageData = UIImageJPEGRepresentation(image, 0.9);
  if ([imageData writeToFile:filePath atomically:YES]) {
    // Trigger the onPasteImage event
    if (self.onPasteImage) {
      self.onPasteImage(@{@"imagePath": filePath});
    }
  }
}

- (BOOL)canPerformAction:(SEL)action withSender:(id)sender {
  if (action == @selector(paste:)) {
    UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
    BOOL hasImage = NO;
    if (@available(iOS 14.0, *)) {
      hasImage = [pasteboard containsPasteboardTypes:@[UTTypeImage.identifier]];
    } else {
      hasImage = [pasteboard image] != nil;
    }
    if (hasImage) {
      return YES;
    }
  }
  return [super canPerformAction:action withSender:sender];
}

@end

@implementation PasteableTextInputView {
  PasteableUITextView *_textView;
}

#ifdef RCT_NEW_ARCH_ENABLED
+ (ComponentDescriptorProvider)componentDescriptorProvider {
  return concreteComponentDescriptorProvider<PasteableTextInputComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    static const auto defaultProps = std::make_shared<const PasteableTextInputProps>();
    _props = defaultProps;
    [self initializeTextView];
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps {
  const auto &oldViewProps = *std::static_pointer_cast<PasteableTextInputProps const>(_props);
  const auto &newViewProps = *std::static_pointer_cast<PasteableTextInputProps const>(props);
  
  [super updateProps:props oldProps:oldProps];
}

- (void)prepareForRecycle {
  [super prepareForRecycle];
  _textView.text = @"";
}

#else

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    [self initializeTextView];
  }
  return self;
}

#endif

- (void)initializeTextView {
  _textView = [[PasteableUITextView alloc] initWithFrame:self.bounds];
  _textView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  _textView.font = [UIFont systemFontOfSize:14];
  
  if (@available(iOS 13.0, *)) {
    _textView.backgroundColor = [UIColor systemBackgroundColor];
    _textView.textColor = [UIColor labelColor];
  } else {
    _textView.backgroundColor = [UIColor whiteColor];
    _textView.textColor = [UIColor blackColor];
  }
  
  [self addSubview:_textView];
}

- (void)setOnPasteImage:(RCTDirectEventBlock)onPasteImage {
  _onPasteImage = onPasteImage;
  _textView.onPasteImage = onPasteImage;
}

- (void)layoutSubviews {
  [super layoutSubviews];
  _textView.frame = self.bounds;
}

#ifdef RCT_NEW_ARCH_ENABLED
Class<RCTComponentViewProtocol> PasteableTextInputCls(void) {
  return PasteableTextInputView.class;
}
#endif

@end

