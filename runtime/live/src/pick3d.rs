//! Pointing at the 3D played live (docs/preview.feature PV1): the part under a point of the page, the page's element
//! and the 3D's part answered as one pick, and a free camera over the scene.

use super::*;
use raea_sys_frame::view::{FreeView, Orbit};

impl Live {
    /// The 3D part under the point (`x`, `y` in page px) as the frame was last drawn (raea-sys-frame pick.rs): its
    /// key, name, box in page px, the point hit in the world and its distance. None with no 3D or over none of it.
    pub fn part_at(&mut self, x: f64, y: f64) -> Option<Value> {
        let (w, h) = (self.w.max(1) as f64, self.h.max(1) as f64);
        let hit = raea_sys_frame::pick::part_at(self.scene.as_mut()?.world_mut(), (x / w) as f32, (y / h) as f32)?;
        let r = hit.rect;
        // the part's JSX as React has it now: the 3D element whose own props (data-props, the SDK's JSON) carry the
        // same stamp, answered as an element is, with those props as its props and its 3D kind as its kind
        let node = hit.key.as_deref().and_then(|key| {
            let loc = key.split(['#', '|']).next().unwrap_or(key);
            let w = self.app.world_mut();
            let mut q = w.query::<(&raea_runtime_react::ReactNode, &raea_runtime_react::ReactProps)>();
            q.iter(w).find_map(|(n, p)| {
                let own = p.0.get("data-props")?.as_str().filter(|t| t.contains(loc))?;
                let own: serde_json::Map<String, Value> = serde_json::from_str(own).ok()?;
                (raea_sys_frame::layer::key_from_props(&own).as_deref() == Some(key)).then(|| (n.0, p.0.get("data-3d").cloned().unwrap_or_default(), own))
            })
        });
        let mut out = match node {
            Some((id, kind, mut own)) => {
                let mut e = self.element(id).unwrap_or_else(|| json!({"owner": "", "text": ""}));
                own.retain(|k, v| k != "children" && !k.starts_with("data-raea-") && !v.is_null());
                e["props"] = Value::Object(own);
                e["kind"] = kind;
                e
            }
            None => json!({"owner": "", "props": {}, "text": "", "kind": "mesh"}),
        };
        out["entity"] = json!(hit.entity.to_bits());
        // where it stands (docs/scene-feed.feature SF4c): what its handles are drawn from
        if let Some(w) = self.scene.as_mut().map(|e| e.world_mut()) {
            out["placed"] = placed_json(raea_sys_frame::hold::placed(w, hit.entity));
        }
        // how a part with no key is asked for again (locate): its entity, as text (its bits don't fit a page's number)
        out["entity_key"] = json!(format!("entity:{}", hit.entity.to_bits()));
        for (k, v) in [("part", json!(true)), ("key", json!(hit.key)), ("name", json!(hit.name)), ("rect", json!([r[0] as f64 * w, r[1] as f64 * h, r[2] as f64 * w, r[3] as f64 * h])), ("point", json!(hit.point.to_array())), ("distance", json!(hit.distance))] {
            out[k] = v;
        }
        Some(out)
    }

    /// What's under the point, the page and the 3D as one picture: the page's element when it is in front of the 3D
    /// (with the part behind it as `under`), else the 3D's part (the page there is the 3D's holder, which shows it
    /// through), else the element. An element that covers the frame gives way to a part under the point, and is
    /// answered as what is `over` it: a film's sheen or grade lies over the whole picture, and with it on top no
    /// click in a scene ever reached an object (every composition of a launch film, 11-10).
    pub fn pick(&mut self, x: f64, y: f64) -> Option<Value> {
        let hit = self.page.hit(x as f32, y as f32);
        let part = self.part_at(x, y);
        let through = match hit {
            None => true,
            Some(id) => {
                let world = self.app.world();
                id == raea_runtime_react::ROOT_ID || self.holders.iter().any(|&e| world.get::<raea_runtime_react::ReactNode>(e).is_some_and(|n| n.0 == id))
            }
        };
        match (part, through) {
            (Some(p), true) => Some(p),
            (p, _) => {
                let mut e = self.element(hit?)?;
                if let Some(k) = e["props"].as_object().and_then(raea_sys_frame::layer::key_from_props) {
                    e["key"] = json!(k);
                }
                let Some(mut p) = p else { return Some(e) };
                let covers = e["rect"].as_array().is_some_and(|r| {
                    let n = |i: usize| r.get(i).and_then(Value::as_f64).unwrap_or(0.0);
                    n(2) * n(3) >= 0.7 * self.w.max(1) as f64 * self.h.max(1) as f64
                });
                if covers {
                    p["over"] = e;
                    return Some(p);
                }
                e["under"] = p;
                Some(e)
            }
        }
    }

    /// The part a key names, as it stands now: its entity (as "entity:BITS") and where it stands. None when nothing
    /// drawn has that key. A picked part asked for again after the scene's code changed (a new world, new entities).
    pub fn part(&mut self, key: &str) -> Option<Value> {
        let w = self.scene.as_mut()?.world_mut();
        let e = raea_sys_frame::hold::part_of(w, key)?;
        Some(json!({"entity_key": format!("entity:{}", e.to_bits()), "placed": placed_json(raea_sys_frame::hold::placed(w, e))}))
    }

    /// The part a key names held at a place in its parent's space (translation, rotation as a quaternion, scale), or
    /// let go of (None): drawn there until then, its code untouched. False with no 3D or no such part.
    pub fn hold(&mut self, key: &str, to: Option<([f32; 3], [f32; 4], [f32; 3])>) -> bool {
        let Some(w) = self.scene.as_mut().map(|e| e.world_mut()) else { return false };
        let Some(e) = raea_sys_frame::hold::part_of(w, key) else { return false };
        let Some(mut held) = w.get_resource_mut::<raea_sys_frame::hold::Held>() else { return false };
        match to {
            Some((t, r, s)) => {
                held.parts.insert(e, Transform { translation: Vec3::from(t), rotation: Quat::from_array(r).normalize(), scale: Vec3::from(s) });
            }
            None => {
                held.parts.remove(&e);
            }
        }
        self.dirty = true;
        true
    }

    /// Every mesh drawn as its edges over its shading, or as it is. False with no 3D or no wireframe pass.
    pub fn wire(&mut self, on: bool) -> bool {
        let Some(w) = self.scene.as_mut().map(|e| e.world_mut()) else { return false };
        let ok = raea_sys_frame::hold::set_wire(w, on);
        self.dirty |= ok;
        ok
    }

    /// The scene drawn from an orbit (yaw and pitch in radians, distance in metres, about `target`) until None puts
    /// the composition's camera back. False with no 3D.
    pub fn set_view(&mut self, orbit: Option<(f32, f32, f32, [f32; 3])>) -> bool {
        let Some(e) = self.scene.as_mut() else { return false };
        let Some(mut v) = e.world_mut().get_resource_mut::<FreeView>() else { return false };
        v.orbit = orbit.map(|(yaw, pitch, distance, t)| Orbit { yaw, pitch, distance, target: Vec3::from(t) });
        self.dirty = true;
        true
    }

    /// The scene's camera as an orbit about the middle of what's drawn, and the scene's radius: where a free camera
    /// starts from. None with no 3D or no camera.
    pub fn view(&mut self) -> Option<Value> {
        let world = self.scene.as_mut()?.world_mut();
        if let Some(o) = world.get_resource::<FreeView>().and_then(|v| v.orbit) {
            return Some(json!({"yaw": o.yaw, "pitch": o.pitch, "distance": o.distance, "target": o.target.to_array(), "free": true}));
        }
        let (mid, radius) = raea_sys_frame::view::bounds(world).unwrap_or((Vec3::ZERO, 1.0));
        let mut cams = world.query_filtered::<(&Camera, &GlobalTransform), With<Camera3d>>();
        let (_, at) = cams.iter(world).filter(|(c, _)| c.is_active).min_by_key(|(c, _)| c.order)?;
        let o = raea_sys_frame::view::orbit_of(at, mid);
        Some(json!({"yaw": o.yaw, "pitch": o.pitch, "distance": o.distance, "target": o.target.to_array(), "radius": radius, "free": false}))
    }

    /// The composition's props set over its defaults while it plays (the entry's raea-props): the frame it is on is
    /// rendered again with them, so the next draw shows them. A game's state is kept; its props only change.
    pub fn set_props(&mut self, props: Value) -> R<()> {
        self.send("raea-props", props);
        // the frame stepped again: its commit with the new props lands in the page as any frame's does
        let f = self.frame;
        self.step_world(f, &[], None, 0.0)
    }

    /// `set_props` before any frame is stepped: sent, and drawn with the first frame.
    pub fn props_before(&mut self, props: Value) {
        self.send("raea-props", props);
    }

    /// Where parts (by key) and world points are on the page now, in page px: `{"parts": [[x, y, w, h] | null],
    /// "points": [[x, y] | null]}`, null for a part not drawn or a point behind the camera. A selection's box and a
    /// note's pin follow what they are on (raea-sys-frame pick.rs locate).
    pub fn locate(&mut self, keys: &[String], points: &[[f32; 3]]) -> Value {
        let (w, h) = (self.w.max(1) as f64, self.h.max(1) as f64);
        let Some(e) = self.scene.as_mut() else { return json!({"parts": vec![Value::Null; keys.len()], "points": vec![Value::Null; points.len()]}) };
        let pts: Vec<Vec3> = points.iter().map(|p| Vec3::from(*p)).collect();
        let (rects, placed) = raea_sys_frame::pick::locate(e.world_mut(), keys, &pts);
        json!({
            "parts": rects.iter().map(|r| r.map(|r| json!([r[0] as f64 * w, r[1] as f64 * h, r[2] as f64 * w, r[3] as f64 * h]))).collect::<Vec<_>>(),
            "points": placed.iter().map(|p| p.map(|p| json!([p[0] as f64 * w, p[1] as f64 * h]))).collect::<Vec<_>>(),
        })
    }
}

/// Where a part stands, for the page: its place in its parent's space and in the world (translation, rotation as a
/// quaternion [x, y, z, w], scale), and its parent's matrix in the world (16 numbers, column by column; null at the top).
fn placed_json(p: raea_sys_frame::hold::Placed) -> Value {
    let trs = |t: Transform| json!({"translation": t.translation.to_array(), "rotation": t.rotation.to_array(), "scale": t.scale.to_array()});
    json!({
        "local": trs(p.local),
        "world": trs(p.world.compute_transform()),
        "parent": p.parent.map(|g| Mat4::from(g.affine()).to_cols_array().to_vec()),
    })
}

/// Scenes opened from here on can be drawn as wireframe (`Live::wire`): the app's stage asks once, before any opens.
pub fn want_wire() {
    raea_sys_frame::hold::want_wire();
}
