/**
 * Suppress iOS Safari double-tap zoom / rubber-band / pinch on app screens.
 * PhotoSwipe (`.pswp--open`) is excluded so pinch + swipe still work there.
 */

const DOUBLE_TAP_MS = 300

function isPhotoSwipeOpen(): boolean {
  return Boolean(document.querySelector('.pswp.pswp--open'))
}

export function installSafariGestureLock(): () => void {
  let lastTouchEnd = 0

  const onTouchEnd = (event: TouchEvent) => {
    if (isPhotoSwipeOpen()) return
    const now = Date.now()
    if (now - lastTouchEnd <= DOUBLE_TAP_MS) {
      event.preventDefault()
    }
    lastTouchEnd = now
  }

  const onTouchMove = (event: TouchEvent) => {
    if (isPhotoSwipeOpen()) return
    // Block pinch-zoom; leave single-finger moves for Draggable / buttons.
    if (event.touches.length > 1) {
      event.preventDefault()
    }
  }

  const onGesture = (event: Event) => {
    if (isPhotoSwipeOpen()) return
    event.preventDefault()
  }

  document.addEventListener('touchend', onTouchEnd, { passive: false })
  document.addEventListener('touchmove', onTouchMove, { passive: false })
  document.addEventListener('gesturestart', onGesture, { passive: false })
  document.addEventListener('gesturechange', onGesture, { passive: false })
  document.addEventListener('gestureend', onGesture, { passive: false })

  return () => {
    document.removeEventListener('touchend', onTouchEnd)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('gesturestart', onGesture)
    document.removeEventListener('gesturechange', onGesture)
    document.removeEventListener('gestureend', onGesture)
  }
}
