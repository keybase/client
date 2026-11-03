/* global module */
// lottie-web reaches for a canvas 2d context as it loads, which jsdom lacks. This is the part of its
// API animation.tsx uses, in its shape: a CommonJS module whose loadAnimation hands back an
// animation that can be destroyed. It draws nothing.
module.exports = {
  loadAnimation: () => ({destroy: () => {}}),
}
