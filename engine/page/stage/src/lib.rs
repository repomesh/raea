//! The live stage (docs/handoff/feed.md, tools on play items): a game item's composition played live in the page, never
//! a video. A thread of its own runs raea-runtime-react's live engine (live.rs: React -> ECS -> the bevy_ui page) at the
//! composition's rate, pauses and steps it, and hands each painted frame (a texture on the shared device, which this
//! app renders on: main.rs) to Bevy, where it's copied on the GPU into the stage's image. The page shows that image in
//! place of its `<img data-raea-stage>` (raea-page's ElementImages, H7), and drives the stage through host calls:
//!
//!   stage.show {src, w, h}     the composition at `src` (a .tsx), laid out at w x h; src null: nothing
//!   stage.play {on}            play or pause
//!   stage.step {n}             paused: n frames on, the keys held as they are
//!   stage.seek {frame}         to that frame, playing or not (a composition's editor, docs/editing.feature E4a: a
//!                              composition is its frame, so the frame is drawn as it is; a game's input isn't replayed)
//!   stage.key {key, down}      a key (DOM name) pressed or let go on the stage
//!   stage.pointer {x, y, down} the pointer in the stage's pixels
//!   stage.status               what it shows, its frame, whether it plays, frames painted, its size, the last error
//!   stage.pick {x, y}          what's under that point of the stage, the page and its 3D as one picture
//!                              (docs/preview.feature PV1a): a 3D part ({part: true, key, name, rect, point,
//!                              distance}) or an element ({id, kind, owner, key, rect, props, text, under?}), or null
//!   stage.view {yaw, pitch, distance, target} | {free: false}
//!                              the 3D drawn from that orbit (radians, metres) until free: false puts the
//!                              composition's camera back (PV1c); with neither, only answers. Answers the view as it
//!                              is now ({yaw, pitch, distance, target, radius?, free}), null with no 3D
//!   stage.locate {keys, points}  where those parts (by key) and world points are on the stage now, px:
//!                              {parts: [[x, y, w, h] | null], points: [[x, y] | null]} (a selection's box and a
//!                              note's pin follow what they are on)
//!   stage.props {props}        the composition's props set over its defaults as it plays (PV4b): the frame it is on is
//!                              drawn again with them; nothing is reopened or written
//!   stage.part {key}           the part that key names as it stands now ({entity_key, placed}), or null
//!                              (docs/scene-feed.feature SF4c); a pick's part carries the same `placed`: {local,
//!                              world: {translation, rotation [x, y, z, w], scale}, parent: 16 numbers | null}
//!   stage.hold {key, translation, rotation, scale} | {key, release: true}
//!                              that part drawn at a place in its parent's space until it is let go of: a drag
//!                              as it looks while it is dragged; nothing is written
//!   stage.wire {on}            every mesh drawn as its edges over its shading (SF3e); answers whether it can
//!   stage.inspect {id}         that element as it is now (its owner, kind, box, props, text), or null once it's gone
//!   stage.tweak {changes}      [{owner, kind, prop, value}]: the props written into the composition as its next
//!                              version (raea-sys-tweak), which the stage then shows at the same frame, its input replayed
//!
//! The legacy app's stage (apps/legacy/shell/src/stage_native.rs and shell-bevy's stage.rs, deleted in 67cfba19) is
//! where this comes from, cut to what a page needs: no window of its own, no present, no bake.
use std::path::PathBuf;
use std::sync::mpsc::{Receiver, RecvTimeoutError, Sender, channel};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use bevy::prelude::*;
use bevy::render::extract_resource::{ExtractResource, ExtractResourcePlugin};
use bevy::render::render_asset::RenderAssets;
use bevy::render::render_resource::{CommandEncoderDescriptor, TextureFormat};
use bevy::render::renderer::{RenderDevice, RenderQueue};
use bevy::render::texture::GpuImage;
use bevy::render::{Render, RenderApp, RenderSystems};
use raea_runtime_js::calls::{Answer, HostCalls};
use raea_sys_page::Docs;
use raea_runtime_dom::host::Roots;
use raea_sys_page::view3d::ElementImages;
use serde_json::{Value, json};

/// The page the stage is in: the app inserts it with the page it mounts (raea-page-host's page::mount).
#[derive(Resource)]
pub struct StagePage(pub Entity);


/// What the page asks of the stage's thread.
enum Cmd {
    Show(Option<PathBuf>, (u32, u32)),
    Play(bool),
    Step(i64),
    Seek(i64),
    Key(String, bool),
    Pointer(f64, f64, bool),
    /// the element under a point of the stage, answered from the thread
    Pick(f64, f64, Answer),
    /// a free camera over the 3D (Some(None): the composition's own again; None: only asked), answered with the view
    View(Option<Option<(f32, f32, f32, [f32; 3])>>, Answer),
    /// where parts and world points are on the stage now
    Locate(Vec<String>, Vec<[f32; 3]>, Answer),
    /// props over the composition's defaults, from now
    Props(Value, Answer),
    /// a part by its key, as it stands now
    Part(String, Answer),
    /// a part held at a place in its parent's space (None: let go of)
    Hold(String, Option<([f32; 3], [f32; 4], [f32; 3])>, Answer),
    /// the scene as wireframe, or as it is
    Wire(bool, Answer),
    /// an element as it is now, by id
    Inspect(u64, Answer),
    /// props written into the next version, which then plays from the same frame
    Tweak(Vec<Change>, Answer),
}

/// A prop to change: the element's component (its nearest), its kind, the prop (`style.KEY` for a style entry), the
/// value.
struct Change {
    owner: String,
    kind: String,
    prop: String,
    value: Value,
}

/// What the stage is doing, for the page's controls (stage.status).
#[derive(Default, Clone)]
struct Status {
    showing: Option<String>,
    frame: i64,
    playing: bool,
    fps: f64,
    painted: u64,
    size: (u32, u32),
    error: Option<String>,
}

/// The latest frame painted, and how many have been.
#[derive(Default)]
struct Painted {
    texture: Option<wgpu::Texture>,
    n: u64,
}

/// The stage: Bevy's image of it, the slot its thread fills, and the way to its thread (made at the first show).
#[derive(Resource, Clone, ExtractResource)]
#[extract_app(bevy::render::RenderApp)]
pub struct Stage {
    image: Handle<Image>,
    slot: Arc<Mutex<Painted>>,
    status: Arc<Mutex<Status>>,
    tx: Arc<Mutex<Option<Sender<Cmd>>>>,
}

impl Stage {
    fn send(&self, c: Cmd) -> Result<(), String> {
        let mut tx = self.tx.lock().unwrap();
        if tx.is_none() {
            let (t, rx) = channel();
            let (status, slot) = (self.status.clone(), self.slot.clone());
            std::thread::Builder::new().name("raea stage".into()).spawn(move || run(rx, status, slot)).map_err(|e| e.to_string())?;
            *tx = Some(t);
        }
        tx.as_ref().unwrap().send(c).map_err(|_| "the stage's thread has stopped".to_string())
    }
    fn size(&self) -> Option<UVec2> {
        self.slot.lock().unwrap().texture.as_ref().map(|t| UVec2::new(t.width(), t.height()))
    }
}

mod calls;
use calls::calls;

pub struct StagePlugin;

impl Plugin for StagePlugin {
    fn build(&self, app: &mut App) {
        let image = app.world_mut().resource_mut::<Assets<Image>>().add(Image::new_target_texture(1, 1, TextureFormat::Rgba8UnormSrgb, None));
        let stage = Stage { image, slot: Default::default(), status: Default::default(), tx: Default::default() };
        // what the stage opens is stamped with its place in the code (engine/bundle stamp.rs), so a pick's part or
        // element has its key (docs/preview.feature PV1b); RAEA_SOURCE_STAMPS=0 in the environment keeps them off
        if std::env::var_os("RAEA_SOURCE_STAMPS").is_none() {
            // SAFETY: the app is being built on its main thread; the stage's thread starts at the first show
            unsafe { std::env::set_var("RAEA_SOURCE_STAMPS", "1") };
        }
        // the stage's scenes can be drawn as wireframe (docs/scene-feed.feature SF3e): asked for before any opens
        raea_runtime_live::want_wire();
        app.insert_resource(stage)
            .init_resource::<HostCalls>()
            .add_plugins(ExtractResourcePlugin::<Stage>::default())
            .add_systems(Startup, calls)
            .add_systems(PostUpdate, (fit, bind));
        if let Some(r) = app.get_sub_app_mut(RenderApp) {
            r.add_systems(Render, copy.in_set(RenderSystems::PrepareResources));
        }
    }
}

/// Bevy's image the painted texture's size (made again when it changes: its GpuImage follows).
fn fit(stage: Res<Stage>, mut images: ResMut<Assets<Image>>) {
    let Some(want) = stage.size() else { return };
    if images.get(&stage.image).map(|i| i.size()) != Some(want) {
        let _ = images.insert(&stage.image, Image::new_target_texture(want.x.max(1), want.y.max(1), TextureFormat::Rgba8UnormSrgb, None));
    }
}

/// The page's `<img data-raea-stage>` shows the stage's image while the stage has a picture (ElementImages: Vello draws
/// it in the element's place).
fn bind(stage: Res<Stage>, page: Option<Res<StagePage>>, roots: Option<NonSend<Roots>>, docs: Option<NonSend<Docs>>, mut shows: ResMut<ElementImages>, mut held: Local<Option<(Entity, blitz_dom::NodeId)>>) {
    let (Some(page), Some(roots), Some(_docs)) = (page, roots, docs) else { return };
    let node = stage.size().and_then(|_| {
        let r = roots.0.iter().find(|r| r.page == page.0)?;
        let id = r.nodes.props.iter().find(|(_, p)| p.contains_key("data-raea-stage")).map(|(id, _)| *id)?;
        raea_sys_page::ops::node(&r.nodes, id).map(|n| (page.0, n))
    });
    if *held != node {
        if let Some(k) = held.take() {
            shows.0.remove(&k);
        }
        if let Some(k) = node {
            shows.0.insert(k, stage.image.clone());
        }
        *held = node;
    }
}

/// A frame painted since the last copy (or Bevy's image made again): copied into Bevy's image on the GPU, before this
/// frame's passes draw it.
fn copy(stage: Res<Stage>, images: Res<RenderAssets<GpuImage>>, device: Res<RenderDevice>, queue: Res<RenderQueue>, mut last: Local<(u64, Option<bevy::render::render_resource::TextureId>)>) {
    let Some(dst) = images.get(&stage.image) else { return };
    let (src, n) = {
        let p = stage.slot.lock().unwrap();
        (p.texture.clone(), p.n)
    };
    let Some(src) = src else { return };
    if *last == (n, Some(dst.texture.id())) || src.size() != dst.texture.size() {
        return;
    }
    let mut enc = device.create_command_encoder(&CommandEncoderDescriptor { label: Some("raea stage") });
    enc.copy_texture_to_texture(src.as_image_copy(), dst.texture.as_image_copy(), src.size());
    queue.submit([enc.finish()]);
    *last = (n, Some(dst.texture.id()));
}

/// The stage's thread: the composition shown stepped at its rate while it plays (frames it fell behind on are stepped,
/// up to four a turn, so no input is lost), held while paused, and each new frame painted into the slot.
fn run(rx: Receiver<Cmd>, status: Arc<Mutex<Status>>, slot: Arc<Mutex<Painted>>) {
    let mut live: Option<raea_runtime_live::Live> = None;
    let mut keys: Vec<String> = Vec::new();
    let mut pointer: Option<(f64, f64, bool)> = None;
    let (mut playing, mut frame, mut base, mut since) = (true, -1i64, 0i64, Instant::now());
    let set_error = |e: String| {
        eprintln!("raea-page-host: stage: {e}");
        status.lock().unwrap().error = Some(e);
    };
    // paused: the frames asked for and not yet stepped (at most 4 a turn, as playing)
    let mut steps = 0i64;
    // the scene shown as wireframe (stage.wire), and a file just opened that hasn't taken it yet
    let (mut wire, mut rewire) = (false, false);
    // RAEA_STAGE_TRACE=1: each frame stepped and its keys, on stderr
    let trace = std::env::var("RAEA_STAGE_TRACE").as_deref() == Ok("1");
    // the stage's size, which the page's points are in
    let mut stage = (1u32, 1u32);
    // what it shows, and the input of each frame stepped since (a tweak's next version replays it)
    let mut shown: Option<PathBuf> = None;
    let mut log: Vec<(Vec<String>, Option<(f64, f64, bool)>)> = Vec::new();
    loop {
        // until the next frame is due while it plays (or a step is left); for the next command while it doesn't
        let due_in = if !playing && steps > 0 { Some(Duration::ZERO) } else { live.as_ref().filter(|_| playing).map(|l| (since + Duration::from_secs_f64((frame - base + 1).max(0) as f64 / l.fps)).saturating_duration_since(Instant::now())) };
        let cmd = match due_in {
            Some(d) => match rx.recv_timeout(d) {
                Ok(c) => Some(c),
                Err(RecvTimeoutError::Timeout) => None,
                Err(RecvTimeoutError::Disconnected) => return,
            },
            None => match rx.recv() {
                Ok(c) => Some(c),
                Err(_) => return,
            },
        };
        let mut repaint = false;
        match cmd {
            Some(Cmd::Show(src, size)) => {
                live = None;
                stage = size;
                keys.clear();
                log.clear();
                pointer = None;
                shown = src.clone();
                (playing, frame, base, since, steps) = (true, -1, 0, Instant::now(), 0);
                *status.lock().unwrap() = Status { showing: src.as_ref().map(|p| p.display().to_string()), playing: true, size, ..default() };
                {
                    let mut p = slot.lock().unwrap();
                    p.texture = None;
                    p.n += 1;
                }
                if let Some(p) = src {
                    match open(&p, size) {
                        Ok(l) => {
                            status.lock().unwrap().fps = l.fps;
                            live = Some(l);
                            rewire = wire;
                        }
                        Err(e) => set_error(e),
                    }
                }
            }
            Some(Cmd::Play(on)) => {
                playing = on;
                steps = 0;
                (base, since) = (frame + 1, Instant::now());
            }
            Some(Cmd::Step(n)) if !playing => steps += n,
            Some(Cmd::Step(_)) => {}
            // the frame before it stands as the last one drawn, and the loop steps to it: one step paused, the clock
            // from there playing
            Some(Cmd::Seek(n)) => {
                frame = n - 1;
                (base, since) = (n, Instant::now());
                steps = if playing { 0 } else { 1 };
                // the input log is a frame each, with nothing held on the frames jumped over
                log.resize(n.max(0) as usize, (Vec::new(), None));
            }
            Some(Cmd::Key(k, down)) => {
                keys.retain(|x| x != &k);
                if down {
                    keys.push(k);
                }
            }
            // a point of the stage is the page's (a game that lays out at its own size is scaled to the stage)
            Some(Cmd::Pick(x, y, answer)) => match live.as_mut() {
                Some(l) => answer.ok(l.pick(x * l.w as f64 / stage.0.max(1) as f64, y * l.h as f64 / stage.1.max(1) as f64).map(|e| on_stage(e, l, stage)).unwrap_or(Value::Null)),
                None => answer.ok(Value::Null),
            },
            Some(Cmd::Locate(keys, points, answer)) => match live.as_mut() {
                Some(l) => {
                    // page px to the stage's
                    let (sx, sy) = (stage.0 as f64 / l.w.max(1) as f64, stage.1 as f64 / l.h.max(1) as f64);
                    let mut v = l.locate(&keys, &points);
                    for list in ["parts", "points"] {
                        for r in v[list].as_array_mut().into_iter().flatten() {
                            for (i, n) in r.as_array_mut().into_iter().flatten().enumerate() {
                                *n = json!(n.as_f64().unwrap_or(0.0) * if i % 2 == 0 { sx } else { sy });
                            }
                        }
                    }
                    answer.ok(v);
                }
                None => answer.ok(Value::Null),
            },
            Some(Cmd::Props(props, answer)) => match live.as_mut() {
                Some(l) if frame >= 0 => match l.set_props(props) {
                    Ok(()) => {
                        answer.ok(json!({"frame": frame}));
                        repaint = true;
                    }
                    Err(e) => answer.err(e),
                },
                // before its first frame: they are there when it is stepped
                Some(l) => {
                    l.props_before(props);
                    answer.ok(json!({"frame": frame}));
                }
                None => answer.err("the stage shows nothing"),
            },
            Some(Cmd::View(set, answer)) => match live.as_mut() {
                Some(l) => {
                    if let Some(orbit) = set {
                        repaint = l.set_view(orbit);
                    }
                    answer.ok(l.view().unwrap_or(Value::Null));
                }
                None => answer.ok(Value::Null),
            },
            Some(Cmd::Part(key, answer)) => answer.ok(live.as_mut().and_then(|l| l.part(&key)).unwrap_or(Value::Null)),
            Some(Cmd::Hold(key, to, answer)) => {
                let held = live.as_mut().is_some_and(|l| l.hold(&key, to));
                repaint |= held;
                answer.ok(json!(held));
            }
            Some(Cmd::Wire(on, answer)) => {
                wire = on;
                let can = live.as_mut().is_some_and(|l| l.wire(on));
                repaint |= can;
                answer.ok(json!(can));
            }
            Some(Cmd::Inspect(id, answer)) => match live.as_mut() {
                Some(l) => answer.ok(l.element(id).map(|e| on_stage(e, l, stage)).unwrap_or(Value::Null)),
                None => answer.ok(Value::Null),
            },
            Some(Cmd::Tweak(changes, answer)) => match (shown.as_deref(), live.as_ref()) {
                (Some(at), Some(_)) => match next_version(at, &changes, stage, &log[..(frame + 1).max(0) as usize]) {
                    Ok((next, l)) => {
                        answer.ok(json!({"written": next.display().to_string(), "frame": frame}));
                        status.lock().unwrap().showing = Some(next.display().to_string());
                        shown = Some(next);
                        live = Some(l);
                        repaint = true;
                    }
                    Err(e) => answer.err(e),
                },
                _ => answer.err("the stage shows nothing to change"),
            },
            Some(Cmd::Pointer(x, y, down)) => {
                pointer = Some((x, y, down));
                repaint = !playing;
            }
            None => {}
        }
        let Some(l) = live.as_mut() else { continue };
        // a file opened again while the scene was shown as wireframe: its 3D is made on a thread, so it is asked each
        // turn until it is there to take it
        if rewire && l.wire(true) {
            rewire = false;
            repaint = true;
        }
        let due = if playing { base + (since.elapsed().as_secs_f64() * l.fps) as i64 } else { frame + steps };
        let mut stepped = 0;
        while frame < due && stepped < 4 {
            if trace {
                eprintln!("raea-page-host: stage: frame {} keys {keys:?} playing {playing}", frame + 1);
            }
            if let Err(e) = l.step(frame + 1, &keys, pointer) {
                set_error(e);
                playing = false;
                break;
            }
            log.push((keys.clone(), pointer));
            frame += 1;
            stepped += 1;
        }
        // paused: what's left of the steps asked for (a step is taken once)
        if !playing {
            steps = (due - frame).max(0);
        }
        // far behind: the clock waits for the frames rather than skipping them (a skipped frame loses its input)
        if playing && frame < due {
            (base, since) = (frame + 1, Instant::now());
        }
        if stepped > 0 || (repaint && frame >= 0) {
            match l.draw() {
                Ok(()) => {
                    let mut p = slot.lock().unwrap();
                    p.texture = l.texture();
                    p.n += 1;
                    status.lock().unwrap().painted += 1;
                }
                Err(e) => set_error(e),
            }
        }
        let mut s = status.lock().unwrap();
        (s.frame, s.playing) = (frame, playing);
    }
}

/// The composition at `p` opened to play, laid out at the stage's box, its sound on (RAEA_AUDIO_MUTE=1: off).
fn open(p: &std::path::Path, size: (u32, u32)) -> Result<raea_runtime_live::Live, String> {
    let mut l = raea_runtime_live::Live::open_with(p, size, true).map_err(|e| format!("{}: {e}", p.display()))?;
    sound(&mut l);
    Ok(l)
}

fn sound(l: &mut raea_runtime_live::Live) {
    if std::env::var("RAEA_AUDIO_MUTE").as_deref() != Ok("1") {
        l.open_mixer();
    }
}

/// The changes written into the next version beside `at` (raea-sys-tweak), opened and stepped through the frames played so
/// far with the input each had, so it stands where the old one did. The old one plays on when any of it fails.
fn next_version(at: &std::path::Path, changes: &[Change], size: (u32, u32), log: &[(Vec<String>, Option<(f64, f64, bool)>)]) -> Result<(PathBuf, raea_runtime_live::Live), String> {
    let src = std::fs::read_to_string(at).map_err(|e| format!("{}: {e}", at.display()))?;
    let tweaks: Vec<raea_sys_tweak::Tweak> = changes.iter().map(|c| raea_sys_tweak::Tweak { owner: &c.owner, kind: &c.kind, prop: &c.prop, value: &c.value }).collect();
    let out = raea_sys_tweak::tweak(&src, &tweaks)?;
    let next = raea_sys_tweak::free_name(at);
    std::fs::write(&next, out).map_err(|e| format!("{}: {e}", next.display()))?;
    // its sound only from here on: the replay is silent
    let mut l = raea_runtime_live::Live::open_with(&next, size, true).map_err(|e| format!("{}: {e}", next.display()))?;
    for (f, (keys, pointer)) in log.iter().enumerate() {
        l.step(f as i64, keys, *pointer).map_err(|e| format!("{} at frame {f}: {e}", next.display()))?;
    }
    l.draw()?;
    sound(&mut l);
    eprintln!("raea-page-host: stage: wrote {}, replayed {} frames", next.display(), log.len());
    Ok((next, l))
}

/// An element's box in the stage's pixels (the page's scaled to the stage), beside its own in page px.
fn on_stage(mut e: Value, l: &raea_runtime_live::Live, size: (u32, u32)) -> Value {
    let (sx, sy) = (size.0 as f64 / l.w.max(1) as f64, size.1 as f64 / l.h.max(1) as f64);
    if let Some(r) = e["rect"].as_array().map(|r| r.iter().filter_map(Value::as_f64).collect::<Vec<_>>()).filter(|r| r.len() == 4) {
        e["stage"] = json!([r[0] * sx, r[1] * sy, r[2] * sx, r[3] * sy]);
    }
    if e.get("under").is_some_and(Value::is_object) {
        e["under"] = on_stage(e["under"].take(), l, size);
    }
    e
}
