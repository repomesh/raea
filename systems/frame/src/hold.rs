//! A part held where a hand has it, and the scene drawn as wireframe (docs/scene-feed.feature SF4c, SF3e): while
//! `Held` names a part, its Transform is put where the hold says after the composition's rows have placed it and
//! before transforms propagate, so the frame draws the part (and all under it) there. Let go, it goes back to where
//! the composition last put it. Nothing in the composition's rows changes: a hold is how a drag looks while it is
//! dragged, and the release writes the scene's code. The same shape as the free camera (view.rs).

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};

use bevy::prelude::*;

use crate::layer::LayerKey;

/// The parts held and where; and what the hold last wrote and what the composition had put there, to tell the
/// composition's own moves from the hold's and to put each part back.
#[derive(Resource, Default)]
pub struct Held {
    pub parts: HashMap<Entity, Transform>,
    wrote: HashMap<Entity, Transform>,
    own: HashMap<Entity, Transform>,
}

/// PostUpdate, before transforms propagate.
pub fn apply(mut held: ResMut<Held>, mut places: Query<&mut Transform>) {
    let Held { parts, wrote, own } = &mut *held;
    // let go of: back where the composition had it
    let gone: Vec<Entity> = wrote.keys().filter(|e| !parts.contains_key(*e)).copied().collect();
    for e in gone {
        wrote.remove(&e);
        if let (Some(o), Ok(mut t)) = (own.remove(&e), places.get_mut(e)) {
            *t = o;
        }
    }
    for (e, to) in parts.iter() {
        let Ok(mut t) = places.get_mut(*e) else { continue };
        // a transform that isn't what the hold wrote is the composition's own, placed since
        if wrote.get(e) != Some(&*t) {
            own.insert(*e, *t);
        }
        if *t != *to {
            *t = *to;
        }
        wrote.insert(*e, *to);
    }
}

/// The part a key names: its LayerKey, or a part with none by its entity ("entity:BITS", as a pick names it).
pub fn part_of(world: &mut World, key: &str) -> Option<Entity> {
    if let Some(bits) = key.strip_prefix("entity:").and_then(|b| b.parse::<u64>().ok()) {
        let mut all = world.query::<Entity>();
        return all.iter(world).find(|e| e.to_bits() == bits);
    }
    let mut keyed = world.query::<(Entity, &LayerKey)>();
    keyed.iter(world).find(|(_, k)| k.0 == key).map(|(e, _)| e)
}

/// Where a part stands: in its parent's space, in the world, and its parent in the world (None at the top). What a
/// handle is drawn from and a drag is turned into the part's own numbers with.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Placed {
    pub local: Transform,
    pub world: GlobalTransform,
    pub parent: Option<GlobalTransform>,
}

pub fn placed(world: &World, e: Entity) -> Placed {
    Placed {
        // as the composition has it, not as a hold has moved it
        local: world.get_resource::<Held>().and_then(|h| h.own.get(&e).copied()).or_else(|| world.get::<Transform>(e).copied()).unwrap_or_default(),
        world: world.get::<GlobalTransform>(e).copied().unwrap_or_default(),
        parent: world.get::<ChildOf>(e).and_then(|p| world.get::<GlobalTransform>(p.parent()).copied()),
    }
}

static WIRE: AtomicBool = AtomicBool::new(false);

/// Engines opened from here on can draw as wireframe (the app's stage asks; a render never does: Bevy's wireframe
/// pass is one more pass in every frame's graph).
pub fn want_wire() {
    WIRE.store(true, Ordering::Relaxed);
}

/// Bevy's wireframe pass added to an engine being built, when asked for (`want_wire`): off until `set_wire`.
pub fn add_wire(app: &mut App) {
    if WIRE.load(Ordering::Relaxed) && !app.is_plugin_added::<bevy::pbr::wireframe::WireframePlugin>() {
        app.add_plugins(bevy::pbr::wireframe::WireframePlugin::default());
    }
}

/// Every mesh drawn as its edges over its shading (on), or as it is (off). False where the engine has no wireframe
/// pass (it wasn't asked for, or the GPU can't draw lines).
pub fn set_wire(world: &mut World, on: bool) -> bool {
    let Some(mut c) = world.get_resource_mut::<bevy::pbr::wireframe::WireframeConfig>() else { return false };
    if c.global != on {
        c.global = on;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_hold_places_the_part_and_letting_go_gives_it_back() {
        let mut app = App::new();
        app.init_resource::<Held>().add_systems(PostUpdate, apply);
        let own = Transform::from_xyz(1.0, 0.0, 0.0);
        let part = app.world_mut().spawn(own).id();
        app.update();
        let to = Transform::from_xyz(3.0, 2.0, 0.0);
        app.world_mut().resource_mut::<Held>().parts.insert(part, to);
        app.update();
        assert_eq!(*app.world().get::<Transform>(part).unwrap(), to);
        // where it stands in its code is still what a reader is told
        assert_eq!(placed(app.world(), part).local, own);
        // the composition moves it meanwhile: the hold stands, and that is where it goes back to
        let moved = Transform::from_xyz(5.0, 0.0, 0.0);
        *app.world_mut().get_mut::<Transform>(part).unwrap() = moved;
        app.update();
        assert_eq!(*app.world().get::<Transform>(part).unwrap(), to);
        app.world_mut().resource_mut::<Held>().parts.clear();
        app.update();
        assert_eq!(*app.world().get::<Transform>(part).unwrap(), moved);
    }

    #[test]
    fn a_part_is_found_by_its_key_or_its_entity() {
        let mut world = World::new();
        let keyed = world.spawn(LayerKey("room.tsx:4:7".into())).id();
        let bare = world.spawn_empty().id();
        assert_eq!(part_of(&mut world, "room.tsx:4:7"), Some(keyed));
        assert_eq!(part_of(&mut world, &format!("entity:{}", bare.to_bits())), Some(bare));
        assert_eq!(part_of(&mut world, "room.tsx:9:9"), None);
    }
}
