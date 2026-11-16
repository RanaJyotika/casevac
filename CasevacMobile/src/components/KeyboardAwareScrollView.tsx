/**
 * ScrollView that keeps the field being typed in visible above the on-screen
 * keyboard.
 *
 * Why: the app draws edge-to-edge (android/gradle.properties
 * edgeToEdgeEnabled=true), and in that mode Android no longer shrinks the
 * window for the keyboard (windowSoftInputMode="adjustResize" has no effect).
 * Without this, the keyboard — about half the screen on a landscape tablet —
 * covers the lower fields (e.g. vitals HR, RR, BP, SpO₂, Temp) while the
 * medic types into them.
 *
 * How: while the keyboard is open the content gets extra bottom room, and the
 * focused input is scrolled to sit just above the keyboard — when the keyboard
 * opens and whenever the medic moves to another field (FormField calls
 * useRevealFocusedInput on focus).
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type HostInstance,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native';

/** Space kept between the focused field and the keyboard / top edge. */
const MARGIN = 24;

/**
 * How far to scroll (positive = down) so a field is fully visible between the
 * top of the scroll area and the keyboard. 0 when it already is. Pure, so it
 * can be tested without a device. All values are window coordinates.
 */
export function scrollDeltaToReveal({
  fieldTop,
  fieldBottom,
  areaTop,
  areaBottom,
  keyboardTop,
  margin = MARGIN,
}: {
  fieldTop: number;
  fieldBottom: number;
  areaTop: number;
  areaBottom: number;
  keyboardTop: number;
  margin?: number;
}): number {
  const visibleTop = areaTop + margin;
  const visibleBottom = Math.min(areaBottom, keyboardTop) - margin;
  if (fieldBottom > visibleBottom) {
    // Below the visible part (behind the keyboard): scroll down — but never
    // so far that the field's top goes off the top.
    return Math.min(fieldBottom - visibleBottom, fieldTop - visibleTop);
  }
  if (fieldTop < visibleTop) {
    return fieldTop - visibleTop; // above: scroll up
  }
  return 0;
}

const RevealContext = createContext<() => void>(() => {});

/** Called by inputs on focus so the field is scrolled above the keyboard. */
export function useRevealFocusedInput(): () => void {
  return useContext(RevealContext);
}

type Measurable = {
  measureInWindow?: (
    cb: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

export function KeyboardAwareScrollView({
  children,
  contentContainerStyle,
  onScroll,
  style,
  ...rest
}: ScrollViewProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const frameRef = useRef<HostInstance>(null);
  const offset = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const reveal = useCallback(() => {
    const top = keyboardTop.current;
    const input = TextInput.State.currentlyFocusedInput() as Measurable | null;
    const frame = frameRef.current as Measurable | null;
    if (top === null || !input?.measureInWindow || !frame?.measureInWindow) {
      return;
    }
    frame.measureInWindow((_fx, fy, _fw, fh) => {
      input.measureInWindow!((_x, y, _w, h) => {
        const delta = scrollDeltaToReveal({
          fieldTop: y,
          fieldBottom: y + h,
          areaTop: fy,
          areaBottom: fy + fh,
          keyboardTop: top,
        });
        if (delta !== 0) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, offset.current + delta),
            animated: true,
          });
        }
      });
    });
  }, []);

  /** Reveal after the focus change / extra bottom room has been laid out. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealSoon = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      reveal();
    }, 80);
  }, [reveal]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardHeight(e.endCoordinates.height);
      revealSoon();
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
      // Screen closed: never scroll a view that is gone.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [revealSoon]);

  return (
    <RevealContext.Provider value={revealSoon}>
      <View ref={frameRef} style={styles.frame} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          style={style}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={e => {
            offset.current = e.nativeEvent.contentOffset.y;
            onScroll?.(e);
          }}
          contentContainerStyle={[
            contentContainerStyle,
            // Room to scroll the last fields above the keyboard.
            keyboardHeight > 0
              ? { paddingBottom: keyboardHeight + MARGIN }
              : null,
          ]}
          {...rest}
        >
          {children}
        </ScrollView>
      </View>
    </RevealContext.Provider>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
});
