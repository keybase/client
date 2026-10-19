// Writes a 10-bit AVIF through ImageIO, the shape Safari re-encodes a page's AVIF to before sharing it.
// Usage: swift make-avif.swift <out.avif> <width> <height>
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 4, let w = Int(args[2]), let h = Int(args[3]) else {
  FileHandle.standardError.write(Data("usage: make-avif.swift <out.avif> <width> <height>\n".utf8))
  exit(2)
}
// 16-bit RGB source, so the encoder has real depth to keep.
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let info = CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue | CGBitmapInfo.byteOrder16Little.rawValue)
guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 16, bytesPerRow: 0, space: space, bitmapInfo: info.rawValue)
else { fatalError("no context") }
let colors = [
  CGColor(red: 0.9, green: 0.2, blue: 0.1, alpha: 1), CGColor(red: 0.1, green: 0.7, blue: 0.3, alpha: 1),
  CGColor(red: 0.1, green: 0.2, blue: 0.9, alpha: 1),
] as CFArray
let grad = CGGradient(colorsSpace: space, colors: colors, locations: nil)!
ctx.drawLinearGradient(grad, start: .zero, end: CGPoint(x: w, y: h), options: [])
guard let image = ctx.makeImage() else { fatalError("no image") }
let url = URL(fileURLWithPath: args[1]) as CFURL
guard let dest = CGImageDestinationCreateWithURL(url, "public.avif" as CFString, 1, nil) else {
  fatalError("this macOS has no AVIF encoder")
}
CGImageDestinationAddImage(dest, image, [
  kCGImageDestinationLossyCompressionQuality: 0.8,
  kCGImagePropertyDepth: 10,
] as CFDictionary)
guard CGImageDestinationFinalize(dest) else { fatalError("AVIF encode failed") }
