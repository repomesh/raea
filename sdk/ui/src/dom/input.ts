// React's event system as React DOM runs it, and the host's input turned into DOM events.
import * as wire from "../wire";
import type { Ev } from "../wire";
import { Control_, DIRECT, Element_, Event_, FocusEvent_, InputEvent_, MouseEvent_, Node_, PointerEvent_, REACT_BY_NATIVE, S, WheelEvent_, activate, addListener, body, byWid, computedOf, container, dispatch, editPointer, focusTarget, focusable, g, inputKind, isField, key, keyUp, report, rootContainer, run, scrolling, selection, tellCapture } from "./all";

// ---------------------------------------------------------------- React's event system, as React DOM runs it

const reactContainers = new Set<Node_>();

/** React listens at a root container (and at each portal's container), in both phases, for every event it
 *  delegates; the handlers run along the fiber tree from the target's instance. */
export function reactContainer(c: Node_) {
  if (reactContainers.has(c)) return;
  reactContainers.add(c);
  for (const t of REACT_BY_NATIVE.keys()) {
    if (DIRECT.has(t)) continue;
    addListener(c, t, (e: Event_) => reactDispatch(c, e, true), true, true);
    addListener(c, t, (e: Event_) => reactDispatch(c, e, false), false, true);
  }
}

function nearestContainer(t: Node_ | null): Node_ | null {
  for (let n = t; n; n = n.parentNode) if (reactContainers.has(n)) return n;
  return null;
}

function nearestInstance(t: Node_ | null): Element_ | null {
  for (let n = t; n; n = n.parentNode) if (n instanceof Element_ && n._fiber) return n;
  return null;
}

/** The host instances from the target's up, along the fiber tree (through portals to where they were rendered). */
function reactPath(inst: Element_): Element_[] {
  const out: Element_[] = [];
  for (let f = inst._fiber; f; f = f.return) if ((f.tag === 5 || f.tag === 26 || f.tag === 27) && f.stateNode instanceof Element_) out.push(f.stateNode);
  return out;
}

const TEXTY = (el: Element_) => isField(el) || el.localName === "textarea";

function reactDispatch(container: Node_, native: Event_, capture: boolean) {
  if (nearestContainer(native.target) !== container) return;
  const inst = nearestInstance(native.target);
  if (!inst) return;
  let names = REACT_BY_NATIVE.get(native.type) ?? [];
  // onChange: a text field's from input; a checkbox's, radio's and select's from change (React's ChangeEventPlugin)
  const tgt = native.target as Element_;
  if (native.type === "input") names = TEXTY(tgt) ? [...names, "onChange"] : names;
  if (native.type === "change") names = TEXTY(tgt) ? names.filter((n) => n !== "onChange") : names;
  if (!names.length) return;
  const path = reactPath(inst);
  for (const name of names) {
    const prop = capture ? `${name}Capture` : name;
    const chain = capture ? path.slice().reverse() : path;
    const hs = chain.filter((el) => typeof el._props[prop] === "function");
    if (!hs.length) continue;
    const se = synthetic(native, name);
    for (const el of hs) {
      if (se._stopped) break;
      se.currentTarget = el;
      try {
        (el._props[prop] as (e: unknown) => void)(se);
      } catch (e) {
        report(e);
      }
    }
    se.currentTarget = null;
  }
}

const REACT_TYPE: Record<string, string> = { onFocus: "focus", onBlur: "blur", onChange: "change", onDoubleClick: "dblclick" };

/** React's SyntheticEvent over a native event: its fields copied, preventDefault and stopPropagation passed on. */
function synthetic(native: any, name: string): any {
  const se: any = {};
  for (const k of Object.keys(native)) if (!k.startsWith("_")) se[k] = native[k];
  se.nativeEvent = native;
  se.type = REACT_TYPE[name] ?? native.type;
  se.target = native.target;
  se._stopped = false;
  se.isDefaultPrevented = () => native.defaultPrevented;
  se.isPropagationStopped = () => se._stopped;
  se.preventDefault = () => {
    native.preventDefault();
    se.defaultPrevented = native.defaultPrevented;
  };
  se.stopPropagation = () => {
    se._stopped = true;
    native.stopPropagation();
  };
  se.persist = () => {};
  se.isPersistent = () => true;
  if (typeof native.getModifierState === "function") se.getModifierState = (k: string) => native.getModifierState(k);
  return se;
}

/** React's handlers for an event that doesn't bubble: the target's own prop only (React attaches these to the
 *  element itself). */
function reactDirect(el: Element_, native: Event_) {
  const names = REACT_BY_NATIVE.get(native.type) ?? [];
  for (const name of names) {
    const fn = el._props[name];
    if (typeof fn !== "function") continue;
    const se = synthetic(native, name);
    se.currentTarget = el;
    try {
      (fn as (e: unknown) => void)(se);
    } catch (e) {
      report(e);
    }
  }
}

/** A non-bubbling event at an element, then React's handler on it */
export function dispatchDirect(el: Element_, ev: Event_) {
  dispatch(el, ev, true);
  if (el._fiber) reactDirect(el, ev);
}

// ---------------------------------------------------------------- input from the host, as DOM events


/** the focus JS asked the host for this frame: the host's echoes of other elements are stale until it arrives */


let downPrevented = false;

let buttons = 0;

let lastPointer: [number, number] = [0, 0];

/** The focus moved from the active element to `to` (null: body): blur and focusout on the one, focus and focusin on
 *  the other, in Chrome's order; the host told when JS moved it. */
export function transition(to: Element_ | null, tellHost: boolean) {
  const from = S.active;
  if (from === to) return;
  S.active = null;
  if (from) {
    dispatchDirect(from, new FocusEvent_("blur", { relatedTarget: to, view: g, composed: true }));
    dispatch(from, new FocusEvent_("focusout", { bubbles: true, relatedTarget: to, view: g, composed: true }), true);
    if (from instanceof Control_ && isField(from) && from._valueAtFocus !== undefined && from._valueAtFocus !== from.value) dispatch(from, new Event_("change", { bubbles: true }), true);
  }
  if (to && to.isConnected) {
    S.active = to;
    if (to instanceof Control_) to._valueAtFocus = to.value;
    dispatchDirect(to, new FocusEvent_("focus", { relatedTarget: from, view: g, composed: true }));
    dispatch(to, new FocusEvent_("focusin", { bubbles: true, relatedTarget: from, view: g, composed: true }), true);
  }
  // the caret shows only in a focused editable (selection.ts's paint)
  selection._changed(false);
  if (tellHost) {
    S.wantFocus = S.active;
    if (S.active?._wired && S.active.__wid !== undefined) wire.emit("focus", S.active.__wid);
    else wire.emit("blur");
  }
}

export function focusTo(el: Element_, tellHost: boolean) {
  if (!focusable(el) || S.active === el) return;
  transition(el, tellHost);
}

/** A clip rectangle [x0, y0, x1, y1] cut to the one it's under (none: itself). */
const within = (own: number[], under: number[] | null) => (under ? [Math.max(own[0], under[0]), Math.max(own[1], under[1]), Math.min(own[2], under[2]), Math.min(own[3], under[3])] : own);

/** The deepest element under (x, y), searched from `from` down: the topmost box that has the point (a higher z,
 *  then the later in the tree), past what clips it and what takes no pointer events. */
export function hit(from: Node_, x: number, y: number): Element_ | null {
  let best: Element_ | null = null;
  let bestZ = -Infinity;
  let bestOrder = -1;
  let n = 0;
  const walk = (node: Node_, clip: number[] | null, z: number) => {
    for (const k of node._kids) {
      if (!(k instanceof Element_)) continue;
      const b = k._box();
      const c = b ? computedOf(k) : null;
      if (c?.display === "none") continue;
      const kz = b && b[16] ? b[16] : z;
      const i = n++;
      let kclip = clip;
      if (b && c && kz === z) {
        const inside = x >= b[0] && x < b[0] + b[2] && y >= b[1] && y < b[1] + b[3];
        const inClip = !clip || (x >= clip[0] && x < clip[2] && y >= clip[1] && y < clip[3]);
        if (inside && inClip && c.pointerEvents !== "none" && (kz > bestZ || (kz === bestZ && i > bestOrder))) {
          best = k;
          bestZ = kz;
          bestOrder = i;
        }
        // its own clip inside the one it's under, never in its place: a card that clips (rounded corners) and lies
        // past its canvas's edge would otherwise hand its children the whole of its own box
        if (c.overflowX !== "visible" || c.overflowY !== "visible") kclip = within([b[0], b[1], b[0] + b[2], b[1] + b[3]], clip);
      } else if (b && c && kz !== z) {
        // a box with its own z-index is still under the clips of the boxes it's in: without them a card zoomed past
        // its canvas's edge took the presses on the page around the canvas (its clip was dropped here). A fixed box
        // is placed against the viewport and is under none. Not read: an absolute box whose containing block is
        // above the clipping box escapes that clip in CSS and stays under it here; a fixed box under a transformed
        // ancestor is clipped in CSS and isn't here. The host's hit test (blitz-dom's hit_inner) reads both for a
        // z-indexed box, and its answer wins where the two differ (pointed, below).
        const under = c.position === "fixed" ? null : clip;
        const inside = x >= b[0] && x < b[0] + b[2] && y >= b[1] && y < b[1] + b[3];
        const inClip = !under || (x >= under[0] && x < under[2] && y >= under[1] && y < under[3]);
        if (inside && inClip && c.pointerEvents !== "none" && (kz > bestZ || (kz === bestZ && i > bestOrder))) {
          best = k;
          bestZ = kz;
          bestOrder = i;
        }
        kclip = c.overflowX !== "visible" || c.overflowY !== "visible" ? within([b[0], b[1], b[0] + b[2], b[1] + b[3]], under) : under;
      }
      walk(k, kclip, kz);
    }
  };
  walk(from, null, 0);
  return best;
}

/** The element a press or move is for. sdk/ui's own walk (hit) reads pointer-events only from inline styles and plain
 *  pointer-events-* classes; the host sends the deepest element it knows on Blitz's hit path, which Stylo's cascade
 *  decided as Chrome's would (a `[&>*]:pointer-events-auto` child under a pointer-events-none dock, a stylesheet's
 *  layer). The walk's answer stands when it lies inside the host's; when they disagree, the host's wins. */
function pointed(from: Node_, x: number, y: number, p: { target?: unknown }): Element_ | null {
  const h = hit(from, x, y);
  const t = typeof p.target === "number" ? byWid(p.target) : null;
  if (!t || !t.isConnected || (h && t.contains(h))) return h;
  return from === body || from.contains(t) ? t : h;
}

function commonAncestor(a: Node_, b: Node_): Element_ | null {
  const sa = new Set<Node_>();
  for (let n: Node_ | null = a; n; n = n.parentNode) sa.add(n);
  for (let n: Node_ | null = b; n; n = n.parentNode) if (sa.has(n) && n instanceof Element_) return n;
  return null;
}

type Ptr = { target?: number; clientX?: number; clientY?: number; button?: number; detail?: number; shiftKey?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; deltaX?: number; deltaY?: number };

function mouseInit(p: Ptr, target: Element_, extra: Record<string, unknown> = {}) {
  const x = p.clientX ?? lastPointer[0];
  const y = p.clientY ?? lastPointer[1];
  const r = target.getBoundingClientRect();
  return {
    bubbles: true, cancelable: true, composed: true, view: g, detail: p.detail ?? 0,
    clientX: x, clientY: y, screenX: x, screenY: y, offsetX: x - r.left, offsetY: y - r.top,
    button: p.button ?? 0, buttons, shiftKey: !!p.shiftKey, ctrlKey: !!p.ctrlKey, altKey: !!p.altKey, metaKey: !!p.metaKey,
    pointerId: 1, pointerType: "mouse", isPrimary: true, width: 1, height: 1, pressure: buttons ? 0.5 : 0,
    ...extra,
  };
}

const KEY_CODES: Record<string, number> = { Enter: 13, Escape: 27, " ": 32, Tab: 9, Backspace: 8, Delete: 46, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Home: 36, End: 35, PageUp: 33, PageDown: 34, Shift: 16, Control: 17, Alt: 18, Meta: 91 };

function codeOf(key: string): string {
  if (key === " ") return "Space";
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return key.length === 1 ? "" : key;
}

export function keyInit(p: any) {
  const key = String(p.key ?? "");
  const keyCode = KEY_CODES[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : 0);
  return { bubbles: true, cancelable: true, composed: true, view: g, key, code: codeOf(key), keyCode, which: keyCode, charCode: 0, repeat: !!p.repeat, shiftKey: !!p.shiftKey, ctrlKey: !!p.ctrlKey, altKey: !!p.altKey, metaKey: !!p.metaKey, location: 0, isComposing: false };
}

/** One host event for an element, as the DOM events Chrome dispatches for it. */
export function hostEvent(el: Node_, ev: Ev, payload: any) {
  run(() => {
    const from = el === rootContainer || (el as Element_).__wid === 0 ? body : el;
    switch (ev) {
      case "pointerdown": {
        const p = (payload ?? {}) as Ptr;
        lastPointer = [p.clientX ?? 0, p.clientY ?? 0];
        const t = pointed(from, lastPointer[0], lastPointer[1], p) ?? (from instanceof Element_ && from !== body ? from : body);
        // a secondary press comes as pointerdown (button 2) before its contextmenu, as Chrome sends them
        buttons = p.button === 2 ? 2 : 1;
        S.downTarget = t;
        const pd = !dispatch(t, new PointerEvent_("pointerdown", mouseInit(p, t)), true);
        downPrevented = pd;
        let md = false;
        if (!pd) md = !dispatch(t, new MouseEvent_("mousedown", mouseInit(p, t)), true);
        // the press's focus: the nearest focusable up from the target, unless pointerdown or mousedown was prevented (a
        // prevented pointerdown sends no mousedown, and the focus is mousedown's default action: Radix's menu trigger
        // relies on it). The host gives the focus its press chose (bevy_input_focus) after this, unless told it was prevented
        if (pd || md) wire.emit("prevented");
        else {
          const f = focusTarget(t);
          if (f) focusTo(f, false);
          else if (S.active) transition(null, false);
          // in an editable: the caret placed, a word or paragraph picked, a drag started (editing.ts)
          editPointer("down", t, lastPointer[0], lastPointer[1], p);
        }
        break;
      }
      case "pointermove": {
        const p = (payload ?? {}) as Ptr;
        lastPointer = [p.clientX ?? 0, p.clientY ?? 0];
        const t = S.pointerCapture ?? pointed(body, lastPointer[0], lastPointer[1], p) ?? body;
        if (dispatch(t, new PointerEvent_("pointermove", mouseInit(p, t, { cancelable: true })), true) && !downPrevented) dispatch(t, new MouseEvent_("mousemove", mouseInit(p, t)), true);
        if (buttons && !downPrevented) editPointer("move", t, lastPointer[0], lastPointer[1], p);
        break;
      }
      case "pointerup": {
        const p = (payload ?? {}) as Ptr;
        lastPointer = [p.clientX ?? lastPointer[0], p.clientY ?? lastPointer[1]];
        const t = S.pointerCapture ?? pointed(body, lastPointer[0], lastPointer[1], p) ?? body;
        buttons = 0;
        editPointer("up", t, lastPointer[0], lastPointer[1], p);
        dispatch(t, new PointerEvent_("pointerup", mouseInit(p, t)), true);
        if (!downPrevented) dispatch(t, new MouseEvent_("mouseup", mouseInit(p, t)), true);
        if (S.pointerCapture) {
          const c = S.pointerCapture;
          S.pointerCapture = null;
          tellCapture(null);
          dispatch(c, new PointerEvent_("lostpointercapture", mouseInit(p, c, { cancelable: false })), true);
        }
        const down = S.downTarget;
        S.downTarget = null;
        const c = down ? commonAncestor(down, t) : null;
        if (c && (p.button ?? 0) === 0) {
          activate(c, new PointerEvent_("click", mouseInit(p, c, { detail: p.detail ?? 1, pointerId: 1, pointerType: "mouse" })), true);
          if ((p.detail ?? 1) === 2) dispatch(c, new MouseEvent_("dblclick", mouseInit(p, c, { detail: 2 })), true);
        } else if (c) dispatch(c, new PointerEvent_("auxclick", mouseInit(p, c, { detail: p.detail ?? 1, pointerId: 1, pointerType: "mouse" })), true);
        break;
      }
      case "contextmenu": {
        const p = (payload ?? {}) as Ptr;
        const t = hit(from, p.clientX ?? 0, p.clientY ?? 0) ?? (from as Element_);
        dispatch(t, new PointerEvent_("contextmenu", mouseInit(p, t, { button: 2, buttons: 2, detail: 1 })), true);
        break;
      }
      case "wheel": {
        // the host puts back what the wheel scrolled when it's prevented
        const p = (payload ?? {}) as Ptr;
        const t = hit(from, p.clientX ?? 0, p.clientY ?? 0) ?? (from as Element_);
        if (!dispatch(t, new WheelEvent_("wheel", mouseInit(p, t, { deltaX: p.deltaX ?? 0, deltaY: p.deltaY ?? 0, deltaZ: 0, deltaMode: 0 })), true)) wire.emit("prevented");
        break;
      }
      case "pointerenter":
      case "pointerleave": {
        if (!(el instanceof Element_) || el === rootContainer) break;
        const init = mouseInit({}, el, { bubbles: false, cancelable: false });
        dispatchDirect(el, new PointerEvent_(ev, init));
        dispatchDirect(el, new MouseEvent_(ev === "pointerenter" ? "mouseenter" : "mouseleave", init));
        break;
      }
      case "scroll": {
        // content scrolled under a still pointer is re-hovered by the host (its hover map follows the content), which
        // sends the enter and leave
        if (!(el instanceof Element_)) break;
        scrolling.set(el, S.frameNo);
        const b = el._box();
        const s = payload ?? {};
        if (b) {
          b[4] = s.scrollLeft ?? b[4];
          b[5] = s.scrollTop ?? b[5];
          if (s.scrollWidth) b[6] = s.scrollWidth;
          if (s.scrollHeight) b[7] = s.scrollHeight;
        }
        el._extra.scrollTop = s.scrollTop;
        el._extra.scrollLeft = s.scrollLeft;
        dispatchDirect(el, new Event_("scroll", { bubbles: false }));
        break;
      }
      case "change": {
        // a field's value after each edit (the host sends one per character, even several in a frame): input, its
        // inputType and data from what the edit changed, as Chrome's
        if (!(el instanceof Control_)) break;
        const v = typeof payload === "string" ? payload : String(payload ?? "");
        const was = el._value ?? el.value;
        if (v === el._value) break;
        el._value = v;
        dispatch(el, new InputEvent_("input", { bubbles: true, cancelable: false, composed: true, ...inputKind(was, v), isComposing: false, view: g }), true);
        break;
      }
      case "keydown":
        key(S.active ?? body, payload);
        break;
      case "keyup":
        keyUp(S.active ?? body, payload);
        break;
      case "focus": {
        if (!(el instanceof Element_)) break;
        if (S.wantFocus !== undefined) {
          if (S.wantFocus === el) S.wantFocus = undefined;
          break;
        }
        if (S.active !== el) transition(el, false);
        break;
      }
      case "blur": {
        if (!(el instanceof Element_)) break;
        if (el instanceof Control_ && payload && typeof payload.value === "string") el._value = payload.value;
        if (S.wantFocus !== undefined) break;
        // the host says where the focus went (`related`, the wire id it moved to), so blur and focusout carry it
        if (S.active === el) {
          const to = typeof payload?.related === "number" ? byWid(payload.related) : null;
          transition(to && focusable(to) ? to : null, false);
        }
        break;
      }
      default:
        break;
    }
  });
}
