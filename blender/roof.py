# Builds the roof terrace in Blender, bakes its light into lightmaps and exports public/models/roof.glb
# + public/models/lightmaps/roof_*.jpg (spec: docs/superpowers/specs/2026-10-04-roof-v2.md).
# Wooden deck, a low parapet around it (white plaster inside, red-orange pantiles on top, brick outside), the DJ booth
# (diamond relief front lit from under the top by a warm LED strip) and two column speakers after the LD Maui 28 G3.
# Light: the festoon bulbs (same spots as in world.ts), the booth LED strip and two small lights on the booth,
# a low orange sun from the direction of the drawn sun and the dusk sky. Emitters are bake-only (three.js draws its own).
# Run: blender -b --factory-startup --python blender/roof.py   (add -- --quick for a fast test bake)
# Geometry is written in three.js coordinates and converted with T() (three.js (x, y, z) = Blender (x, -z, y)).
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
LM = os.path.join(OUT, 'lightmaps')
QUICK = '--quick' in sys.argv

N, RISE, RUN, Z0 = 36, 0.24, 0.26, -1.0
RY, ROOF_Z = N * RISE, Z0 - N * RUN - 1.6
BZ = ROOF_Z - 6.5                       # booth centre (where the live DJ table stands)
X0, X1, ZB = -7.0, 7.0, ROOF_Z - 14.0   # terrace: x from X0 to X1, from the stair housing (ROOF_Z) to ZB
PH, PT = 1.0, 0.3                       # parapet height and thickness
ORANGE, PINK = (1.0, 0.302, 0.0), (1.0, 0.169, 0.839)
def srgb2lin(c): return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
def T(x, y, z): return Vector((x, -z, y))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def mat(name, rgb, rough=0.6, emit=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    if emit: b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    return m

DECK = mat('roof_deck', (0.10, 0.05, 0.03), 0.7)
PLASTER = mat('roof_plaster', (0.75, 0.73, 0.70), 0.9)
TILE = mat('roof_tile', (0.45, 0.10, 0.04), 0.6)
BRICK = mat('roof_brick', (0.30, 0.12, 0.08), 0.9)
BOOTH = mat('booth_wood', (0.32, 0.16, 0.07), 0.55)
DARK = mat('booth_dark', (0.02, 0.02, 0.022), 0.4)       # booth top, decks, mixer, speakers
LED = mat('glow_led', (0, 0, 0), 1, srgb2lin(ORANGE), 30.0)
CANDLE = mat('glow_candle', (0, 0, 0), 1, srgb2lin((1.0, 0.7, 0.4)), 40.0)

meshes = {}
def face(name, m, pts, facing):
    """A polygon in three.js coordinates; facing = the direction (three.js) its front should point."""
    if name not in meshes: meshes[name] = (bmesh.new(), m)
    bm = meshes[name][0]; f = bm.faces.new([bm.verts.new(T(*p)) for p in pts]); f.normal_update()
    if f.normal.dot(T(*facing)) < 0: f.normal_flip()

def box(name, m, c, size, axes=None):
    ax = axes or (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    c = Vector(c); h = [ax[i] * size[i] / 2 for i in range(3)]
    corner = lambda sx, sy, sz: tuple(c + h[0] * sx + h[1] * sy + h[2] * sz)
    for f in [((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)), ((-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, -1, -1)),
              ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)), ((-1, -1, 1), (-1, -1, -1), (1, -1, -1), (1, -1, 1)),
              ((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)), ((1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1))]:
        # the face points along the one axis on which all its corners share a sign
        side = sum((h[i] * f[0][i] for i in range(3) if all(q[i] == f[0][i] for q in f)), Vector())
        face(name, m, [corner(*p) for p in f], tuple(side))

def half_tube(name, m, a, b, r, seg=8):
    """A rounded pantile: half a cylinder (open side down) from a to b."""
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    u = d.cross(Vector((0, 1, 0))).normalized(); v = Vector((0, 1, 0))
    ring = lambda p: [p + (u * math.cos(k / seg * math.pi) + v * math.sin(k / seg * math.pi)) * r for k in range(seg + 1)]
    ra, rb = ring(a), ring(b)
    for k in range(seg):
        out = u * math.cos((k + 0.5) / seg * math.pi) + v * math.sin((k + 0.5) / seg * math.pi)
        face(name, m, [tuple(ra[k]), tuple(ra[k + 1]), tuple(rb[k + 1]), tuple(rb[k])], tuple(out))

# ---------------------------------------------------------------- deck
face('deck', DECK, [(X0, RY, ROOF_Z), (X1, RY, ROOF_Z), (X1, RY, ZB), (X0, RY, ZB)], (0, 1, 0))

# ---------------------------------------------------------------- parapet: far side and both sides
# runs: (start, end) along the inner face, with the inward direction
runs = [((X0, ZB), (X1, ZB), (0, 1)), ((X0, ROOF_Z), (X0, ZB), (1, 0)), ((X1, ZB), (X1, ROOF_Z), (-1, 0))]
for (ax, az), (bx, bz), (nx, nz) in runs:
    # inner face (plaster), top (plaster), outer face (brick)
    ox, oz = -nx * PT, -nz * PT
    face('plaster', PLASTER, [(ax, RY, az), (bx, RY, bz), (bx, RY + PH, bz), (ax, RY + PH, az)], (nx, 0, nz))
    face('plaster', PLASTER, [(ax, RY + PH, az), (bx, RY + PH, bz), (bx + ox, RY + PH, bz + oz), (ax + ox, RY + PH, az + oz)], (0, 1, 0))
    face('brick', BRICK, [(ax + ox, RY - 3, az + oz), (bx + ox, RY - 3, bz + oz), (bx + ox, RY + PH, bz + oz), (ax + ox, RY + PH, az + oz)], (-nx, 0, -nz))
    # pantiles across the top, side by side (red-orange, rounded)
    L = math.hypot(bx - ax, bz - az); n = int(L / 0.2)
    for k in range(n):
        t = (k + 0.5) / n; cx, cz = ax + (bx - ax) * t, az + (bz - az) * t
        half_tube('tiles', TILE, (cx + nx * 0.06, RY + PH + 0.02, cz + nz * 0.06), (cx + ox - nx * 0.06, RY + PH + 0.02, cz + oz - nz * 0.06), 0.1)

# ---------------------------------------------------------------- DJ booth
BW, BD, BH = 2.0, 0.8, 1.0
bf = BZ + BD / 2                                     # front face (toward the camera, +z)
box('booth_body', BOOTH, (0, RY + BH / 2, BZ), (BW, BH, BD))
box('booth_top', DARK, (0, RY + BH + 0.03, BZ + 0.05), (BW + 0.2, 0.06, BD + 0.2))   # overhangs the front and sides
# diamond relief: rows of four-sided pyramids on the front and both sides
def diamonds(origin, right, up, out, width, height, w=0.2, h=0.24, depth=0.045):
    """Rows of four-sided pyramids (a diamond relief), every other row shifted half a diamond."""
    r = 0
    while h / 2 + r * h / 2 + h / 2 <= height + 1e-6:
        cy, off = h / 2 + r * h / 2, (w / 2 if r % 2 else 0)
        for k in range(int(width / w) + 1):
            cx = off + w / 2 + k * w
            if cx + w / 2 > width + 1e-6: break
            c = origin + right * cx + up * cy
            pts = [c - right * w / 2, c - up * h / 2, c + right * w / 2, c + up * h / 2]; apex = c + out * depth
            for i in range(4):
                mid = (pts[i] + pts[(i + 1) % 4]) / 2
                face('booth_body', BOOTH, [tuple(pts[i]), tuple(pts[(i + 1) % 4]), tuple(apex)], tuple((mid - c).normalized() + out))
        r += 1
diamonds(Vector((-BW / 2, RY + 0.02, bf)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), BW, BH - 0.06)
diamonds(Vector((BW / 2, RY + 0.02, bf)), Vector((0, 0, -1)), Vector((0, 1, 0)), Vector((1, 0, 0)), BD, BH - 0.06)
diamonds(Vector((-BW / 2, RY + 0.02, BZ - BD / 2)), Vector((0, 0, 1)), Vector((0, 1, 0)), Vector((-1, 0, 0)), BD, BH - 0.06)
# warm LED strip under the overhang, along the front and sides (bake-only light)
box('led', LED, (0, RY + BH - 0.015, bf + 0.08), (BW + 0.1, 0.015, 0.02))
for sx in (-1, 1): box('led', LED, (sx * (BW / 2 + 0.08), RY + BH - 0.015, BZ + 0.05), (0.02, 0.015, BD + 0.1))
# decks and mixer on top, two small warm lights at the front corners
for x, w in [(-0.5, 0.34), (0, 0.32), (0.5, 0.34)]:
    box('gear', DARK, (x, RY + BH + 0.06 + 0.05, BZ + 0.02), (w, 0.1, 0.4))
for sx in (-1, 1):
    box('candle', CANDLE, (sx * 0.85, RY + BH + 0.09, BZ + 0.38), (0.04, 0.06, 0.04))

# ---------------------------------------------------------------- speakers after the LD Maui 28 G3: sub + slim column, ~2 m
def speaker(x, toe):
    out = Vector((math.sin(toe), 0, math.cos(toe))); right = Vector((math.cos(toe), 0, -math.sin(toe))); up = Vector((0, 1, 0))
    base = Vector((x, RY, BZ + 0.1))
    box('speaker', DARK, tuple(base + up * 0.36), (0.38, 0.72, 0.55), (right, up, out))                      # subwoofer
    box('speaker', DARK, tuple(base + up * 0.36 + out * 0.276), (0.32, 0.6, 0.01), (right, up, out))         # sub grille
    box('speaker', DARK, tuple(base + up * 0.76), (0.1, 0.08, 0.1), (right, up, out))                        # coupler
    box('speaker', DARK, tuple(base + up * 1.39), (0.11, 1.18, 0.12), (right, up, out))                      # column
    for k in range(14):                                                                                    # the stacked drivers
        box('speaker', DARK, tuple(base + up * (0.86 + k * 0.08) + out * 0.062), (0.085, 0.06, 0.006), (right, up, out))
speaker(-1.75, 0.25); speaker(1.75, -0.25)

# ---------------------------------------------------------------- objects
objs = {}
for name, (bm, m) in meshes.items():
    me = bpy.data.meshes.new(name); bm.normal_update(); bm.to_mesh(me); bm.free(); me.materials.append(m)
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); objs[name] = ob

# festoon bulbs: the same three strings as world.ts (x from -6 to 6, sagging 0.9 m), as small warm lamps
def light(name, kind, loc, energy, color, size=0.05, rot=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'POINT': ld.shadow_soft_size = size
    if kind == 'SUN': ld.angle = math.radians(3)
    ob = bpy.data.objects.new(name, ld); scene.collection.objects.link(ob); ob.location = loc
    if rot: ob.rotation_euler = rot
bulb = srgb2lin(tuple(a + (b - a) * 0.3 for a, b in zip(ORANGE, (1.0, 0.957, 0.91))))
for z in (ROOF_Z - 4.5, ROOF_Z - 7, ROOF_Z - 9.5):
    for k in range(1, 19):
        u = (k - 1) / 18; x = -6 + 12 * u
        light('bulb', 'POINT', T(x, RY + 3.4 - math.sin(u * math.pi) * 0.9 - 0.08, z), 4.0, bulb)
# the low sun, from where world.ts draws it (x 30, far away along -z): grazing orange light over the parapet
sd = (Vector(T(30, RY + 1, ROOF_Z - 160)) - Vector(T(0, RY, ROOF_Z))).normalized()
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 0.6; sun.color = srgb2lin(ORANGE); sun.angle = math.radians(3)
so = bpy.data.objects.new('sun', sun); scene.collection.objects.link(so)
so.rotation_euler = (-sd).to_track_quat('-Z', 'Y').to_euler()
# dusk sky: dark purple overhead, pink-orange low (the same gradient as the sky in world.ts), dim
w = bpy.data.worlds.new('dusk'); scene.world = w; w.use_nodes = True; nt = w.node_tree
bg = next(n for n in nt.nodes if n.type == 'BACKGROUND'); bg.inputs['Strength'].default_value = 0.5
tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
nt.links.new(tc.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
ramp.color_ramp.elements[0].position = 0.48; ramp.color_ramp.elements[0].color = (*srgb2lin(ORANGE), 1)
ramp.color_ramp.elements[1].position = 0.75; ramp.color_ramp.elements[1].color = (*srgb2lin((0.07, 0.024, 0.1)), 1)
mid = ramp.color_ramp.elements.new(0.56); mid.color = (*srgb2lin(tuple(c * 0.55 for c in PINK)), 1)
nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])

def uv_world(ob, tile):
    me = ob.data; bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co
            u, v = ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
            l[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me); bm.free()

# ---------------------------------------------------------------- bake
scene.render.engine = 'CYCLES'
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'; prefs.refresh_devices()
    for dv in prefs.devices: dv.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    print('GPU unavailable, using CPU', e)
scene.cycles.samples = 16 if QUICK else 512
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 90

BAKE = {'deck': (2048, 1.2), 'plaster': (1024, 1.0), 'brick': (512, 1.6), 'tiles': (1024, 1.0),
        'booth_body': (1024, 1.0), 'booth_top': (256, 1.0), 'gear': (256, 1.0), 'speaker': (512, 1.0)}
exposures = {}
for name, (size, tile) in BAKE.items():
    ob = objs[name]; me = ob.data
    uv_world(ob, tile)
    lm = me.uv_layers.new(name='lightmap'); me.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    size = 128 if QUICK else size
    img = bpy.data.images.new(f'lm_{name}', size, size, float_buffer=True)
    nt = me.materials[0].node_tree; node = nt.nodes.new('ShaderNodeTexImage'); node.image = img
    for n in nt.nodes: n.select = False
    node.select = True; nt.nodes.active = node
    print('baking', name, size, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=8, use_clear=True)
    px = np.array(img.pixels[:]).reshape(-1, 4)
    p99 = float(np.percentile(px[:, :3].max(axis=1), 99.5)) or 1.0
    exposures[name] = 0.92 / p99
    print('  p99.5', p99, flush=True)
    px[:, :3] *= exposures[name]; img.pixels[:] = px.ravel()
    img.save_render(os.path.join(LM, f'roof_{name}.jpg'), scene=scene)
    nt.nodes.remove(node)
    me.uv_layers.active = me.uv_layers[0]; me.uv_layers[0].active_render = True
json.dump(exposures, open(os.path.join(LM, 'roof.json'), 'w'), indent=1)

bpy.ops.object.select_all(action='DESELECT')
for name in BAKE: objs[name].select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'roof.glb'), export_format='GLB', use_selection=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='NONE',
                          export_lights=False, export_cameras=False,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
print('exported', os.path.join(OUT, 'roof.glb'), flush=True)
