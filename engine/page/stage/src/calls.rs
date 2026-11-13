//! The page's host calls for the stage (lib.rs lists them): each read from its arguments and sent to the stage's
//! thread, which answers the ones that ask something of the composition.

use super::*;

pub(super) fn settle(answer: raea_runtime_js::calls::Answer, r: Result<Value, String>) {
    match r {
        Ok(v) => answer.ok(v),
        Err(e) => answer.err(e),
    }
}

/// The page's host calls (the module's list).
pub(super) fn calls(mut calls: ResMut<HostCalls>) {
    let num = |a: &Value, k: &str| a.get(k).and_then(Value::as_f64);
    let send = |w: &mut World, c: Cmd| w.resource::<Stage>().send(c).map(|_| Value::Null);
    calls
        .on("stage.show", move |w, a, answer| {
            if !raea_gpu_device::enabled() {
                return answer.err("the stage needs the shared device (RAEA_SHARED_DEVICE=0 turned it off)");
            }
            // a feed item names its game as the app's host does (host/make.ts resolve): ~/ is the home
            let src = a.get("src").and_then(Value::as_str).map(|s| match (s.strip_prefix("~/"), std::env::var_os("HOME")) {
                (Some(rest), Some(home)) => PathBuf::from(home).join(rest),
                _ => PathBuf::from(s),
            });
            let size = (num(&a, "w").unwrap_or(1280.0).round().max(1.0) as u32, num(&a, "h").unwrap_or(720.0).round().max(1.0) as u32);
            settle(answer, send(w, Cmd::Show(src, size)));
        })
        .on("stage.play", move |w, a, answer| settle(answer, send(w, Cmd::Play(a.get("on").and_then(Value::as_bool).unwrap_or(true)))))
        .on("stage.step", move |w, a, answer| settle(answer, send(w, Cmd::Step(num(&a, "n").unwrap_or(1.0).max(0.0) as i64))))
        .on("stage.seek", move |w, a, answer| settle(answer, send(w, Cmd::Seek(num(&a, "frame").unwrap_or(0.0).max(0.0).round() as i64))))
        .on("stage.key", move |w, a, answer| {
            let key = a.get("key").and_then(Value::as_str).unwrap_or_default().to_string();
            settle(answer, send(w, Cmd::Key(key, a.get("down").and_then(Value::as_bool).unwrap_or(true))));
        })
        .on("stage.pointer", move |w, a, answer| {
            settle(answer, send(w, Cmd::Pointer(num(&a, "x").unwrap_or(0.0), num(&a, "y").unwrap_or(0.0), a.get("down").and_then(Value::as_bool).unwrap_or(false))));
        })
        .on("stage.pick", move |w, a, answer| {
            let (x, y) = (num(&a, "x").unwrap_or(0.0), num(&a, "y").unwrap_or(0.0));
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::Pick(x, y, answer));
                }
                None => answer.ok(Value::Null),
            }
        })
        .on("stage.view", move |w, a, answer| {
            let f = |k: &str| num(&a, k).map(|v| v as f32);
            let target = a.get("target").and_then(Value::as_array).map(|t| t.iter().filter_map(Value::as_f64).map(|v| v as f32).collect::<Vec<_>>()).filter(|t| t.len() == 3);
            let set = match (a.get("free").and_then(Value::as_bool), f("yaw"), f("pitch"), f("distance")) {
                (Some(false), ..) => Some(None),
                (_, Some(yaw), Some(pitch), Some(distance)) => Some(Some((yaw, pitch, distance, target.map_or([0.0; 3], |t| [t[0], t[1], t[2]])))),
                _ => None,
            };
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::View(set, answer));
                }
                None => answer.ok(Value::Null),
            }
        })
        .on("stage.locate", move |w, a, answer| {
            let keys: Vec<String> = a.get("keys").and_then(Value::as_array).into_iter().flatten().filter_map(|k| k.as_str().map(str::to_string)).collect();
            let points: Vec<[f32; 3]> = a.get("points").and_then(Value::as_array).into_iter().flatten().filter_map(|p| {
                let p: Vec<f32> = p.as_array()?.iter().filter_map(Value::as_f64).map(|v| v as f32).collect();
                (p.len() == 3).then(|| [p[0], p[1], p[2]])
            }).collect();
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::Locate(keys, points, answer));
                }
                None => answer.ok(Value::Null),
            }
        })
        .on("stage.props", move |w, a, answer| {
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::Props(a.get("props").cloned().unwrap_or(Value::Null), answer));
                }
                None => answer.err("the stage shows nothing"),
            }
        })
        .on("stage.part", move |w, a, answer| {
            let key = a.get("key").and_then(Value::as_str).unwrap_or_default().to_string();
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::Part(key, answer));
                }
                None => answer.ok(Value::Null),
            }
        })
        .on("stage.hold", move |w, a, answer| {
            let key = a.get("key").and_then(Value::as_str).unwrap_or_default().to_string();
            let list = |k: &str, n: usize| a.get(k).and_then(Value::as_array).map(|v| v.iter().filter_map(Value::as_f64).map(|x| x as f32).collect::<Vec<_>>()).filter(|v| v.len() == n && v.iter().all(|x| x.is_finite()));
            let to = match (a.get("release").and_then(Value::as_bool), list("translation", 3), list("rotation", 4), list("scale", 3)) {
                (Some(true), ..) => None,
                (_, Some(t), Some(r), Some(s)) => Some(([t[0], t[1], t[2]], [r[0], r[1], r[2], r[3]], [s[0], s[1], s[2]])),
                _ => return answer.err("stage.hold takes a key with translation [x, y, z], rotation [x, y, z, w] and scale [x, y, z], or release: true"),
            };
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::Hold(key, to, answer));
                }
                None => answer.ok(json!(false)),
            }
        })
        .on("stage.wire", move |w, a, answer| {
            let on = a.get("on").and_then(Value::as_bool).unwrap_or(true);
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::Wire(on, answer));
                }
                None => answer.ok(json!(false)),
            }
        })
        .on("stage.inspect", move |w, a, answer| {
            let id = a.get("id").and_then(Value::as_u64).unwrap_or(0);
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::Inspect(id, answer));
                }
                None => answer.ok(Value::Null),
            }
        })
        .on("stage.tweak", move |w, a, answer| {
            let s = |c: &Value, k: &str| c.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
            let changes: Vec<Change> = a.get("changes").and_then(Value::as_array).into_iter().flatten().map(|c| Change { owner: s(c, "owner"), kind: s(c, "kind"), prop: s(c, "prop"), value: c.get("value").cloned().unwrap_or_default() }).collect();
            let tx = w.resource::<Stage>().tx.lock().unwrap().clone();
            match tx {
                Some(tx) => {
                    let _ = tx.send(Cmd::Tweak(changes, answer));
                }
                None => answer.err("the stage shows nothing to change"),
            }
        })
        .on("stage.status", |w, _a, answer| {
            let s = w.resource::<Stage>().status.lock().unwrap().clone();
            answer.ok(json!({"showing": s.showing, "frame": s.frame, "playing": s.playing, "fps": s.fps, "painted": s.painted, "size": [s.size.0, s.size.1], "error": s.error}));
        });
}
