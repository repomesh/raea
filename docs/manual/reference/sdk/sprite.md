---
title: "raea/sprite"
summary: "2D pictures and flat shapes, drawn by Bevy's 2D renderer inside a Canvas3D."
order: 82
sources: ["sdk/raea/src/sprite.ts"]
---

`<Sprite>` is Bevy's sprite: a picture in the 2D world, or one cell of a sprite sheet or atlas. `<Mesh2d>` holds a
flat shape and a `ColorMaterial`; the shapes are Bevy's 2D primitives (`Circle`, `Rectangle`, `Ellipse`, `Annulus`,
`RegularPolygon`, `Triangle2d` and the rest). They draw inside a `<Canvas3D>`, in Bevy's 2D coordinates: the centre
of the frame is the origin, +Y is up, and a unit is a pixel.

```tsx
import { staticFile } from "raea";
import { Canvas3D } from "raea/camera";
import { Circle, ColorMaterial, Mesh2d, Sprite } from "raea/sprite";

const Shot = () => (
  <Canvas3D layered clearColor="rgb(43, 44, 47)">
    <Sprite src={staticFile("branding/bevy_bird_dark.png")} x={640} y={360} />
    <Mesh2d transform={{ translation: [-300, 0, 0] }}>
      <Circle radius={50} />
      <ColorMaterial color="#e8b04a" />
    </Mesh2d>
  </Canvas3D>
);
```

<!-- generated:begin by tools/manual-ref/sdk.ts from the SDK's exports and doc comments; edit outside this block -->

```ts
import { Annulus, Capsule2d, Circle, CircularSector } from "raea/sprite"
```

`raea/sprite` exports 17 components, 1 class, 20 types. Bevy's counterpart: `bevy_sprite`. Source: [sdk/raea/src/sprite.ts](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/src/sprite.ts).

## Components

### `Annulus`

*From Bevy's `bevy_shape::Annulus`:* A primitive shape formed by the region between two circles, also known as a ring.

| Prop | Type | What it does |
| --- | --- | --- |
| `inner_circle` | `{ radius: number }` | Bevy: The inner circle of the annulus |
| `outer_circle` | `{ radius: number }` | Bevy: The outer circle of the annulus |

Also takes the props of [`MeshAttributes`](#meshattributes) (`vertex_colors`); [`RingProps`](#ringprops) (`ring`, `inner`).

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `Capsule2d`

*From Bevy's `bevy_shape::Capsule2d`:* A 2D capsule primitive, also known as a stadium or pill shape.

| Prop | Type | What it does |
| --- | --- | --- |
| `radius` | `number` | Bevy: The radius of the capsule |
| `half_length` | `number` | Bevy: Half the height of the capsule, excluding the semicircles |

Also takes the props of [`MeshAttributes`](#meshattributes) (`vertex_colors`); [`RingProps`](#ringprops) (`ring`, `inner`).

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `Circle`

bevy_math's Circle (radius 0.5 by default, as Bevy's)

Bevy: `bevy_shape::Circle`.

| Prop | Type | What it does |
| --- | --- | --- |
| `radius` | `number` | Bevy: The radius of the circle |

Also takes the props of [`MeshAttributes`](#meshattributes) (`vertex_colors`); [`RingProps`](#ringprops) (`ring`, `inner`).

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `CircularSector`

bevy_math's other 2D primitives, their fields as Bevy reflects them (each over Bevy's default)

Bevy: `bevy_shape::CircularSector`.

Takes [`ArcProps`](#arcprops)'s props.

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `CircularSegment`

*From Bevy's `bevy_shape::CircularSegment`:* A primitive representing a circular segment: the area enclosed by the arc of a circle and its chord (the line between its endpoints).

Takes [`ArcProps`](#arcprops)'s props.

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `ColorMaterial`

bevy_sprite_render's ColorMaterial: a colour (white by default), a texture it tints, and its AlphaMode2d

| Prop | Type | What it does |
| --- | --- | --- |
| `color` | `string \| Srgba \| LinearRgba` | white by default; it tints the texture, and its alpha is the material's (Bevy's Srgba or LinearRgba, or a hex) |
| `texture` | `string \| SampledImage` | a picture, by the mesh's UVs, or one with its own sampler ({ path, sampler }, Bevy's load_with_settings) |
| `uv_transform` | `Affine2` | the texture's UVs scaled, turned and moved (glam's Affine2: Affine2.fromScale([2, 3])) |
| `alpha_mode` | `AlphaMode2d` | Bevy's AlphaMode2d, "Blend" by default |

Used in: [2d/mesh2d_vertex_color_texture](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_vertex_color_texture.tsx), [2d/mesh2d_alpha_mode](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_alpha_mode.tsx), [2d/mesh2d](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d.tsx), [2d/mesh2d_repeated_texture](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_repeated_texture.tsx), [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `ConvexPolygon`

*From Bevy's `bevy_shape::ConvexPolygon`:* A convex polygon with `N` vertices.

Takes [`VerticesProps`](#verticesprops)'s props.

### `Ellipse`

bevy_math's Ellipse (half_size [1, 0.5] by default)

Bevy: `bevy_shape::Ellipse`.

| Prop | Type | What it does |
| --- | --- | --- |
| `half_size` | `Vec2` | Bevy: Half of the width and height of the ellipse. |

Also takes the props of [`MeshAttributes`](#meshattributes) (`vertex_colors`); [`RingProps`](#ringprops) (`ring`, `inner`).

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `Mesh2d`

Bevy's Mesh2d with its Transform, a primitive and a ColorMaterial: <Shape2D> in Bevy's 2D world.

Takes [`Mesh2dProps`](mesh.md#mesh2dprops)'s props.

Used in: [shader/shader_material_2d_bindless](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/shader/shader_material_2d_bindless.tsx), [shader/shader_material_2d](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/shader/shader_material_2d.tsx), [shader/pipeline_constants](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/shader/pipeline_constants.tsx), [2d/mesh2d_vertex_color_texture](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_vertex_color_texture.tsx), [2d/mesh2d_alpha_mode](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_alpha_mode.tsx), [2d/mesh2d](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d.tsx), [2d/mesh2d_repeated_texture](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_repeated_texture.tsx), [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `Polyline2d`

*From Bevy's `bevy_shape::Polyline2d`:* A series of connected line segments in 2D space.

Takes [`VerticesProps`](#verticesprops)'s props.

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `Rectangle`

bevy_math's Rectangle (half_size [0.5, 0.5] by default)

| Prop | Type | What it does |
| --- | --- | --- |
| `half_size` | `Vec2` | half its width and height |

Also takes the props of [`MeshAttributes`](#meshattributes) (`vertex_colors`); [`RingProps`](#ringprops) (`ring`, `inner`).

Used in: [shader/shader_material_2d_bindless](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/shader/shader_material_2d_bindless.tsx), [shader/shader_material_2d](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/shader/shader_material_2d.tsx), [shader/pipeline_constants](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/shader/pipeline_constants.tsx), [2d/mesh2d_vertex_color_texture](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_vertex_color_texture.tsx), [2d/mesh2d_alpha_mode](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_alpha_mode.tsx), [2d/mesh2d](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d.tsx), [2d/mesh2d_repeated_texture](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/mesh2d_repeated_texture.tsx), [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `RegularPolygon`

bevy_math's RegularPolygon (circumradius 0.5, 6 sides by default)

Bevy: `bevy_shape::RegularPolygon`.

| Prop | Type | What it does |
| --- | --- | --- |
| `circumcircle` | `{ radius: number }` | Bevy: The circumcircle on which all vertices lie |
| `sides` | `number` | Bevy: The number of sides |

Also takes the props of [`MeshAttributes`](#meshattributes) (`vertex_colors`); [`RingProps`](#ringprops) (`ring`, `inner`).

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `Rhombus`

*From Bevy's `bevy_shape::Rhombus`:* A rhombus primitive, also known as a diamond shape. A four sided polygon, centered on the origin, where opposite sides are parallel but without requiring right angles.

| Prop | Type | What it does |
| --- | --- | --- |
| `half_diagonals` | `Vec2` | Bevy: Size of the horizontal and vertical diagonals of the rhombus |

Also takes the props of [`MeshAttributes`](#meshattributes) (`vertex_colors`); [`RingProps`](#ringprops) (`ring`, `inner`).

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `Segment2d`

*From Bevy's `bevy_shape::Segment2d`:* A line segment defined by two endpoints in 2D space.

Takes [`VerticesProps`](#verticesprops)'s props.

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

### `Shape2D`

A flat shape in 2D, over the 3D, in one colour: Bevy's Mesh2d with a ColorMaterial (raea-sys-sprite). Put it
inside the Canvas3D.

Bevy: `bevy_sprite_render::mesh2d::color_material::ColorMaterial`, `bevy_sprite_render::mesh2d::material::MeshMaterial2d<bevy_sprite_render::mesh2d::color_material::ColorMaterial>`, `bevy_mesh::components::Mesh2d`.

Takes [`Shape2DProps`](3d.md#shape2dprops)'s props.

Used in: [animation/color_animation](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/animation/color_animation.tsx), [2d/text2d](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/text2d.tsx).

### `Sprite`

A picture in 2D, over the 3D: Bevy's Sprite, drawn as a quad with its sprite material, a sprite sheet's cells cut
by a texture atlas (raea-sys-sprite). Put it inside the Canvas3D.

Bevy: `bevy_sprite::sprite::Sprite`, `bevy_sprite_render::sprite_mesh::sprite_mesh_material::SpriteMeshMaterial`, `bevy_sprite_render::mesh2d::material::MeshMaterial2d<bevy_sprite_render::sprite_mesh::sprite_mesh_material::SpriteMeshMaterial>`, `bevy_sprite_render::sprite_mesh::sprite_extended_material::SpriteMaterial`, `bevy_image::texture_atlas::TextureAtlasLayout`.

Takes [`SpriteProps`](3d.md#spriteprops)'s props.

### `Triangle2d`

*From Bevy's `bevy_shape::Triangle2d`:* A triangle in 2D space

Takes [`VerticesProps`](#verticesprops)'s props.

Used in: [2d/2d_shapes](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/2d_shapes.tsx).

## Classes

### `TextureAtlasBuilder`

Pictures packed into one atlas, as Bevy's TextureAtlasBuilder: `padding([x, y])` px around each, `addTexture` in
order, then `build({ sampler })` (the atlas's own sampler, Bevy's default otherwise).

Bevy: `bevy_image::texture_atlas_builder::TextureAtlasBuilder`, `bevy_image::texture_atlas::TextureAtlasSources`.

| Member | What it does |
| --- | --- |
| `.padding(p: [number, number]): TextureAtlasBuilder` | Whole px of space around each picture, [x, y]. |
| `.addTexture(src: string): TextureAtlasBuilder` | Adds a picture, packed in the order added. |
| `.build({ sampler }?: { sampler?: SamplerSpec \| undefined; }): BuiltAtlas` | Packs the atlas, with its own sampler if given (Bevy's default otherwise). |

Used in: [2d/texture_atlas](https://github.com/shinyobjectz/raea/blob/main/sdk/raea/bench/bevy-parity/2d/texture_atlas.tsx).

## Types

### `AlphaMode2d`

bevy_sprite_render's AlphaMode2d

```ts
type AlphaMode2d = "Opaque" | "Blend" | { Mask: number }
```

### `AnnulusProps`

The props of [`Annulus`](#annulus), tabled there.

### `ArcProps`

an arc: its radius and half its angle in radians (Bevy's CircularSector::new(r, a) gives half_angle a)

| Field | Type | What it is |
| --- | --- | --- |
| `arc` | `{ radius: number; half_angle: number }` | its radius and half its angle in radians |
| `vertex_colors` | `(LinearRgba \| [number, number, number, number])[]` | one linear colour a vertex, in the mesh's vertex order (ATTRIBUTE_COLOR) |
| `ring` | `number` | a thickness: the shape made a ring that thick (to_ring) |
| `inner` | `Record<string, unknown>` | the ring's inner shape, as the same shape's fields |

### `AtlasSprite`

What a <Sprite> takes to show a built atlas: the whole of it, or one of its pictures (`atlasPick`).

| Field | Type | What it is |
| --- | --- | --- |
| `src` (required) | `string` | the atlas picture |
| `sampler` | `SamplerSpec` | how it's sampled (the atlas's own sampler) |
| `atlasPick` | `number` | which of its pictures shows (the whole atlas when left out) |

### `BuiltAtlas`

A built atlas: `image` the whole atlas as a sprite's picture, `sources.handle(texture)` one picture of it
(TextureAtlasSources::handle).

| Field | Type | What it is |
| --- | --- | --- |
| `image` (required) | `AtlasSprite` | the whole atlas, as a sprite's picture |
| `sources` (required) | `{ handle(texture: string): AtlasSprite }` | \`handle(texture)\`: one of the pictures packed into it, by its file |

### `Capsule2dProps`

The props of [`Capsule2d`](#capsule2d), tabled there.

### `CircleProps`

The props of [`Circle`](#circle), tabled there.

### `ColorMaterialProps`

The props of [`ColorMaterial`](#colormaterial), tabled there.

### `EllipseProps`

The props of [`Ellipse`](#ellipse), tabled there.

### `Mesh2dProps`

| Field | Type | What it is |
| --- | --- | --- |
| `transform` | `TransformValue` | where it stands: translation, rotation (a quaternion) and scale |
| `visibility` | `"Inherited" \| "Visible" \| "Hidden"` | "Hidden" draws nothing; "Visible" and "Inherited" draw |
| `children` | `ReactNode` | one of bevy_math's 2D primitives (<Circle>, <Capsule2d>,...) and a <ColorMaterial>, or your own <Material> |
| `name` | `string` | the entity's name, for picking, the inspector and world.* |
| `onClick` | `(e: Event3d) => void` | a press and release over the part |
| `onDrag` | `(e: Event3d) => void` | the part pressed is being dragged, each frame it moves |
| `onDragEnd` | `(e: Event3d) => void` | the drag of the part pressed ended |
| `onDragEnter` | `(e: Event3d) => void` | a dragged part came over this one (`dragged` names it) |
| `onDragLeave` | `(e: Event3d) => void` | a dragged part left this one |
| `onDragOver` | `(e: Event3d) => void` | a dragged part is over this one |
| `onDragStart` | `(e: Event3d) => void` | a drag began on the part pressed |
| `onDrop` | `(e: Event3d) => void` | a dragged part was dropped on this one |
| `onPointerDown` | `(e: Event3d) => void` | a button pressed over the part |
| `onPointerMove` | `(e: Event3d) => void` | the pointer moved over the part |
| `onPointerUp` | `(e: Event3d) => void` | a button released over the part |
| `onPointerEnter` | `(e: Event3d) => void` | the pointer came over the part (doesn't bubble) |
| `onPointerLeave` | `(e: Event3d) => void` | the pointer left the part (doesn't bubble) |
| `onPointerOver` | `(e: Event3d) => void` | the pointer came over the part (bubbles, as the DOM's) |
| `onPointerOut` | `(e: Event3d) => void` | the pointer left the part (bubbles) |
| `onWheel` | `(e: Event3d) => void` | the wheel turned over the part (`deltaX`, `deltaY`) |
| `opacity` | `number` | 0 to 1 (1 by default) |
| `quat` | `Quat` | Bevy's rotation as it is, a quaternion [x, y, z, w] in Bevy's axes (y up, z toward the viewer), in place of `rotation`: a turn out of the frame's plane too, as a Sprite's Transform takes it (camera/2d_on_ui) |

### `MeshAttributes`

a primitive's mesh attributes: its Mesh::ATTRIBUTE_COLOR, one linear colour per vertex (as mesh.insert_attribute)

| Field | Type | What it is |
| --- | --- | --- |
| `vertex_colors` | `(LinearRgba \| [number, number, number, number])[]` | one linear colour a vertex, in the mesh's vertex order (ATTRIBUTE_COLOR) |

### `Place2dProps`

Where a 2D part is: composition px from the frame's top left, y down (as the page's), its centre there; and its
pointer and drag handlers, called as a 3D part's are (2D parts are picked first, the top one by z).

| Field | Type | What it is |
| --- | --- | --- |
| `name` | `string` | the entity's name, for picking, the inspector and world.* |
| `x` | `number` | px from the frame's left edge to the part's centre |
| `y` | `number` | px from the frame's top edge to the part's centre, down positive |
| `rotation` | `number` | radians, clockwise (as CSS rotate) |
| `quat` | `Quat` | Bevy's rotation as it is, a quaternion [x, y, z, w] in Bevy's axes (y up, z toward the viewer), in place of `rotation`: a turn out of the frame's plane too, as a Sprite's Transform takes it (camera/2d_on_ui) |
| `scale` | `number \| [number, number]` | 1 by default; [x, y] to stretch |
| `z` | `number` | draw order among the 2D parts: higher draws over lower (0 by default) |
| `opacity` | `number` | 0 to 1 (1 by default) |
| `onClick` | `(e: Event3d) => void` | a press and release over the part |
| `onPointerDown` | `(e: Event3d) => void` | a button pressed over the part |
| `onPointerUp` | `(e: Event3d) => void` | a button released over the part |
| `onPointerOver` | `(e: Event3d) => void` | the pointer came over the part (bubbles, as the DOM's) |
| `onPointerOut` | `(e: Event3d) => void` | the pointer left the part (bubbles) |
| `onPointerEnter` | `(e: Event3d) => void` | the pointer came over the part (doesn't bubble) |
| `onPointerLeave` | `(e: Event3d) => void` | the pointer left the part (doesn't bubble) |
| `onPointerMove` | `(e: Event3d) => void` | the pointer moved over the part |
| `onWheel` | `(e: Event3d) => void` | the wheel turned over the part (`deltaX`, `deltaY`) |
| `onDragStart` | `(e: Event3d) => void` | a drag began on the part pressed |
| `onDrag` | `(e: Event3d) => void` | the part pressed is being dragged, each frame it moves |
| `onDragEnd` | `(e: Event3d) => void` | the drag of the part pressed ended |
| `onDragEnter` | `(e: Event3d) => void` | a dragged part came over this one (`dragged` names it) |
| `onDragOver` | `(e: Event3d) => void` | a dragged part is over this one |
| `onDragLeave` | `(e: Event3d) => void` | a dragged part left this one |
| `onDrop` | `(e: Event3d) => void` | a dragged part was dropped on this one |

### `RectangleProps`

The props of [`Rectangle`](#rectangle), tabled there.

### `RegularPolygonProps`

The props of [`RegularPolygon`](#regularpolygon), tabled there.

### `RhombusProps`

The props of [`Rhombus`](#rhombus), tabled there.

### `RingProps`

a 2D shape as Bevy's Ring: of it and `inner` (the same shape's fields), or its to_ring(`ring`, a thickness)

| Field | Type | What it is |
| --- | --- | --- |
| `ring` | `number` | a thickness: the shape made a ring that thick (to_ring) |
| `inner` | `Record<string, unknown>` | the ring's inner shape, as the same shape's fields |

### `Shape2DProps`

| Field | Type | What it is |
| --- | --- | --- |
| `shape` | `"rect" \| "circle" \| "ellipse" \| "triangle" \| "polygon"` | a rect by default; a polygon has `sides` (5 by default) |
| `size` | `[number, number]` | [width, height] in px ([100, 100] by default); a circle's and a polygon's diameter is the width |
| `sides` | `number` | a polygon's number of sides (5) |
| `color` | `string` | a CSS colour (white by default); with a texture, it tints it |
| `srgb` | `[number, number, number]` | the colour as a Bevy Srgba's [r, g, b], unrounded, over `color` (a Mesh2d's ColorMaterial gives it) |
| `texture` | `string \| { path: string; sampler: SamplerSpec }` | a picture on it, mapped by the mesh's UVs (Bevy's ColorMaterial texture), or one with its own sampler (Bevy's load_with_settings: { path, sampler: { wrap: "repeat" } }) |
| `uv_transform` | `{ scale: [number, number]; angle: number; translation: [number, number] }` | the texture's UVs scaled, turned and moved (ColorMaterial's uv_transform, glam's Affine2 as raea/transform's) |
| `alpha_mode` | `AlphaMode2d` | Bevy's AlphaMode2d: "Blend" (Bevy's default), "Opaque", or { Mask: cutoff } |
| `vertex_colors` | `[number, number, number, number][]` | one linear [r, g, b, a] per vertex of the shape's mesh (Bevy's Mesh::ATTRIBUTE_COLOR): the material's colour and texture are multiplied by them. A rect has 4 (top right, top left, bottom left, bottom right), a triangle 3. |
| `shader` | `Record<string, unknown>` | its own Material2d in place of the ColorMaterial: the spec a <Material> in a Mesh2d makes; the shape's colour, texture and alpha_mode are then the material's to draw |
| `primitive` | `Record<string, unknown>` | one of Bevy's 2D primitives in place of `shape`, its reflected fields over Bevy's default: { primitive: "Capsule2d", radius: 25, half_length: 25 }; a 2D shape given `inner` (the same shape's fields) is Bevy's Ring, or given `ring: thickness` its to_ring (raea-sys-mesh primitive_mesh). A Mesh2d's primitive child makes it. |
| `name` | `string` | the entity's name, for picking, the inspector and world.* |
| `x` | `number` | px from the frame's left edge to the part's centre |
| `y` | `number` | px from the frame's top edge to the part's centre, down positive |
| `rotation` | `number` | radians, clockwise (as CSS rotate) |
| `quat` | `Quat` | Bevy's rotation as it is, a quaternion [x, y, z, w] in Bevy's axes (y up, z toward the viewer), in place of `rotation`: a turn out of the frame's plane too, as a Sprite's Transform takes it (camera/2d_on_ui) |
| `scale` | `number \| [number, number]` | 1 by default; [x, y] to stretch |
| `z` | `number` | draw order among the 2D parts: higher draws over lower (0 by default) |
| `opacity` | `number` | 0 to 1 (1 by default) |
| `onClick` | `(e: Event3d) => void` | a press and release over the part |
| `onPointerDown` | `(e: Event3d) => void` | a button pressed over the part |
| `onPointerUp` | `(e: Event3d) => void` | a button released over the part |
| `onPointerOver` | `(e: Event3d) => void` | the pointer came over the part (bubbles, as the DOM's) |
| `onPointerOut` | `(e: Event3d) => void` | the pointer left the part (bubbles) |
| `onPointerEnter` | `(e: Event3d) => void` | the pointer came over the part (doesn't bubble) |
| `onPointerLeave` | `(e: Event3d) => void` | the pointer left the part (doesn't bubble) |
| `onPointerMove` | `(e: Event3d) => void` | the pointer moved over the part |
| `onWheel` | `(e: Event3d) => void` | the wheel turned over the part (`deltaX`, `deltaY`) |
| `onDragStart` | `(e: Event3d) => void` | a drag began on the part pressed |
| `onDrag` | `(e: Event3d) => void` | the part pressed is being dragged, each frame it moves |
| `onDragEnd` | `(e: Event3d) => void` | the drag of the part pressed ended |
| `onDragEnter` | `(e: Event3d) => void` | a dragged part came over this one (`dragged` names it) |
| `onDragOver` | `(e: Event3d) => void` | a dragged part is over this one |
| `onDragLeave` | `(e: Event3d) => void` | a dragged part left this one |
| `onDrop` | `(e: Event3d) => void` | a dragged part was dropped on this one |

### `SpriteImageMode`

Bevy's SpriteImageMode, as its reflected value

Bevy: `bevy_sprite::sprite::SpriteImageMode`.

```ts
type SpriteImageMode = | "Auto" | { Scale: "FillCenter" | "FillStart" | "FillEnd" | "FitCenter" | "FitStart" | "FitEnd" } | { Sliced: { border?: number | { min_inset: [number, number]; max_inset: [number, number] }; center_scale_mode?: SliceScaleMode; sides_scale_mode?: SliceScaleMode; max_corner_scale?: number } } | {…
```

### `SpriteProps`

| Field | Type | What it is |
| --- | --- | --- |
| `src` (required) | `string` | a picture in the media folder: staticFile("hero.png"), or a "render:NAME" image a camera or a <Compute> draws (a frame may switch it to another by name) |
| `width` | `number` | size in px (the picture's, or one cell's, by default); one given, the other follows the picture's shape |
| `height` | `number` | in px; given alone, the width follows the picture's shape |
| `grid` | `[number, number]` | a sprite sheet: the picture is `[columns, rows]` cells of equal size, read left to right, top to bottom |
| `atlasPick` | `number` | one picture of a built atlas (TextureAtlasBuilder's sources.handle gives it with its src): its index in the atlas's list |
| `frame` | `number` | with `grid`: which cell shows (0 is the top left); animate it to play the sheet: frame={Math.floor(f / 3)} |
| `flipX` | `boolean` | mirrored left to right |
| `flipY` | `boolean` | mirrored top to bottom |
| `color` | `string` | a tint multiplied over the picture (white by default) |
| `tileX` | `boolean` | Bevy's SpriteImageMode::Tiled: the picture repeats across the sprite's width (tileX) or height (tileY) instead of stretching to it, a tile every `tileStretch` x the picture's size (1 by default): a floor, a fence, a wall. Animate width and height to show more or fewer tiles |
| `tileY` | `boolean` | tile the picture down its height instead of stretching it |
| `tileStretch` | `number` | a tile every this many times the picture's size (1) |
| `image_mode` | `SpriteImageMode` | Bevy's SpriteImageMode, as its reflected value: "Auto" (stretched to the size), { Scale: "FillCenter" } (and FillStart, FillEnd, FitCenter, FitStart, FitEnd: the picture kept to its shape, cropped or fitted), { Sliced: TextureSlicer } (nine-slice: border a number of px or { min_inset: [x, y], max_inset: [x, y] }; center_scale_mode and sides_scale_mode "Stretch" or { Tile: { stretch_value } }; max_corner_scale) or { Tiled: { tile_x, tile_y, stretch_value } }. Not with tileX or tileY |
| `sampler` | `SamplerSpec` | the picture's sampler (Bevy's load_with_settings: { filter, mipmap, wrap, anisotropy }), Bevy's default (linear) otherwise; { filter: "nearest" } is pixel art as Bevy's ImagePlugin::default_nearest() draws it |
| `children` | `ReactNode` | your own <Material> as its child: Bevy's SpriteMaterial, extending the sprite's own material (the shader reads the sprite's picture, tint and alpha with bevy_sprite_render::sprite_mesh::functions), its uniforms per frame |
| `name` | `string` | the entity's name, for picking, the inspector and world.* |
| `x` | `number` | px from the frame's left edge to the part's centre |
| `y` | `number` | px from the frame's top edge to the part's centre, down positive |
| `rotation` | `number` | radians, clockwise (as CSS rotate) |
| `quat` | `Quat` | Bevy's rotation as it is, a quaternion [x, y, z, w] in Bevy's axes (y up, z toward the viewer), in place of `rotation`: a turn out of the frame's plane too, as a Sprite's Transform takes it (camera/2d_on_ui) |
| `scale` | `number \| [number, number]` | 1 by default; [x, y] to stretch |
| `z` | `number` | draw order among the 2D parts: higher draws over lower (0 by default) |
| `opacity` | `number` | 0 to 1 (1 by default) |
| `onClick` | `(e: Event3d) => void` | a press and release over the part |
| `onPointerDown` | `(e: Event3d) => void` | a button pressed over the part |
| `onPointerUp` | `(e: Event3d) => void` | a button released over the part |
| `onPointerOver` | `(e: Event3d) => void` | the pointer came over the part (bubbles, as the DOM's) |
| `onPointerOut` | `(e: Event3d) => void` | the pointer left the part (bubbles) |
| `onPointerEnter` | `(e: Event3d) => void` | the pointer came over the part (doesn't bubble) |
| `onPointerLeave` | `(e: Event3d) => void` | the pointer left the part (doesn't bubble) |
| `onPointerMove` | `(e: Event3d) => void` | the pointer moved over the part |
| `onWheel` | `(e: Event3d) => void` | the wheel turned over the part (`deltaX`, `deltaY`) |
| `onDragStart` | `(e: Event3d) => void` | a drag began on the part pressed |
| `onDrag` | `(e: Event3d) => void` | the part pressed is being dragged, each frame it moves |
| `onDragEnd` | `(e: Event3d) => void` | the drag of the part pressed ended |
| `onDragEnter` | `(e: Event3d) => void` | a dragged part came over this one (`dragged` names it) |
| `onDragOver` | `(e: Event3d) => void` | a dragged part is over this one |
| `onDragLeave` | `(e: Event3d) => void` | a dragged part left this one |
| `onDrop` | `(e: Event3d) => void` | a dragged part was dropped on this one |

### `VerticesProps`

| Field | Type | What it is |
| --- | --- | --- |
| `vertices` | `Vec2[]` | the outline's points, in order |
| `vertex_colors` | `(LinearRgba \| [number, number, number, number])[]` | one linear colour a vertex, in the mesh's vertex order (ATTRIBUTE_COLOR) |
| `ring` | `number` | a thickness: the shape made a ring that thick (to_ring) |
| `inner` | `Record<string, unknown>` | the ring's inner shape, as the same shape's fields |

<!-- generated:end -->
