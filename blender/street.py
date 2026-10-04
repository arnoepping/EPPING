# Builds the night street in Blender, bakes the lighting into lightmaps and exports public/models/street.glb
# + public/models/lightmaps/*.jpg. The building follows the Amsterdam School references (orange-red brick, rounded
# corner, dark pantile bands between floors, a wavy tiled top edge, few wide multi-pane windows).
# Textures are NOT embedded: three.js applies them by material name (public/models/textures/), see src/entrance/world.ts.
# Run: blender -b --factory-startup --python blender/street.py   (add -- --quick for a fast test bake)
#
# Coordinates: Blender is Z-up; glTF export turns (x, y, z) into three.js (x, z, -y). The facade front is at y = 0,
# the street at y < 0, the building at y > 0. The club door (x -0.6..0.6, height 2.3) stays open: door, neon sign,
# rope and stairwell are three.js.
import bpy, bmesh, math, os, random, sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
LM = os.path.join(OUT, 'lightmaps')
os.makedirs(LM, exist_ok=True)
QUICK = '--quick' in sys.argv
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
# Base colours here only matter for the bake (bounce light); three.js swaps in the real textures by name.
def mat(name, rgb, rough=0.6, metal=0.0, emit=None, strength=0.0, tile=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = strength
    if tile: m['tile'] = tile
    return m

BRICK = mat('brick', (0.42, 0.14, 0.07), 0.9, tile=1.6)
PAVE = mat('pavement', (0.08, 0.08, 0.085), 0.8, tile=1.8)
ROAD = mat('road', (0.035, 0.035, 0.04), 0.85, tile=3.0)
KERB = mat('kerb', (0.12, 0.12, 0.12), 0.8)
TRIM = mat('trim', (0.62, 0.58, 0.48), 0.5)                 # cream window frames
TILE = mat('tile', (0.03, 0.03, 0.035), 0.45)               # dark glazed pantiles (bands + wavy top)
DARK = mat('dark', (0.02, 0.018, 0.02), 0.45, 0.3)          # shopfront frames
BOLLARD = mat('bollard', (0.18, 0.05, 0.035), 0.5)          # Amsterdammertjes
BARK = mat('bark', (0.05, 0.04, 0.03), 0.9)
LEAF = mat('leaf', (0.03, 0.06, 0.03), 0.8)                 # alpha leaf cards (texture applied in three.js)
GLASS = mat('glass', (0.008, 0.009, 0.014), 0.06, 0.7)
LIT = mat('window_lit', (0, 0, 0), 0.3, 0, emit=(1.0, 0.55, 0.25), strength=2.5)
SHOP = mat('shop_lit', (0.008, 0.008, 0.01), 0.1, 0.6, emit=(1.0, 0.65, 0.4), strength=0.35)
TIRE = mat('tire', (0.015, 0.015, 0.015), 0.7)
STEEL = mat('steel', (0.5, 0.5, 0.52), 0.3, 1.0)
BIKES = [mat('bike_black', (0.02, 0.02, 0.022), 0.35, 0.4), mat('bike_white', (0.75, 0.74, 0.72), 0.35, 0.2), mat('bike_red', (0.4, 0.04, 0.05), 0.35, 0.4)]
SADDLE = mat('saddle', (0.03, 0.025, 0.025), 0.6)
BAR_TAPE = mat('bar_tape', (0.22, 0.12, 0.45), 0.6)         # purple bar tape like the reference bike

# ---------------------------------------------------------------- geometry helpers
def link(ob): scene.collection.objects.link(ob); return ob

def box(name, m, x0, x1, y0, y1, z0, z1):
    me = bpy.data.meshes.new(name); ob = link(bpy.data.objects.new(name, me))
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1); bm.to_mesh(me); bm.free()
    ob.scale = ((x1 - x0), (y1 - y0), (z1 - z0)); ob.location = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    me.materials.append(m); return ob

def tube(name, m, p, q, r, verts=8):
    p, q = Vector(p), Vector(q)
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=(q - p).length, location=(p + q) / 2)
    ob = bpy.context.object; ob.name = name; ob.data.materials.append(m)
    ob.rotation_euler = (q - p).to_track_quat('Z', 'Y').to_euler(); return ob

def cyl(name, m, x, y, z0, z1, r, verts=12, r_top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r_top is None else r_top, depth=z1 - z0, location=(x, y, (z0 + z1) / 2))
    ob = bpy.context.object; ob.name = name; ob.data.materials.append(m); return ob

def sphere(name, m, x, y, z, r, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=(x, y, z))
    ob = bpy.context.object; ob.name = name; ob.data.materials.append(m); return ob

# ---------------------------------------------------------------- the building
H0, HF, FLOORS = 4.0, 3.1, 3
TOP = H0 + HF * FLOORS
X0, X1, D = -13.0, 9.0, 0.4
box('facade_l', BRICK, X0, -0.6, 0, D, 0, TOP)
box('facade_r', BRICK, 0.6, X1, 0, D, 0, TOP)
box('facade_top', BRICK, -0.6, 0.6, 0, D, 2.3, TOP)
# rounded corner, turning into the side street
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=2.6, depth=TOP, location=(X1, 2.6, TOP / 2))
corner = bpy.context.object; corner.name = 'corner'; corner.data.materials.append(BRICK)
box('side_wall', BRICK, X1 + 2.2, X1 + 2.6, 2.6, 16, 0, TOP)

def wave(x):  # height of the wavy top edge
    return TOP + 0.75 + 0.45 * math.cos((x - X0) / (X1 - X0) * math.tau * 1.5)

# wavy parapet: a strip whose top follows wave(x)
me = bpy.data.meshes.new('parapet'); ob = link(bpy.data.objects.new('parapet', me)); bm = bmesh.new()
xs = [X0 + i * 0.25 for i in range(int((X1 - X0) / 0.25) + 1)]
prev = None
for x in xs:
    vs = [bm.verts.new((x, y, z)) for (y, z) in ((0, TOP), (0, wave(x)), (D, wave(x)), (D, TOP))]
    if prev:
        for a in range(4):
            bm.faces.new((prev[a], prev[(a + 1) % 4], vs[(a + 1) % 4], vs[a]))
    prev = vs
bm.to_mesh(me); bm.free(); me.materials.append(BRICK)

# dark pantile rows: a band at every floor line and along the wavy top (rounded tiles side by side)
def tile_row(z_of_x, y_front=-0.16):
    x = X0
    while x < X1:
        z = z_of_x(x)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.085, depth=0.34, location=(x, y_front + 0.17, z), rotation=(math.pi / 2 + 0.25, 0, 0))
        t = bpy.context.object; t.name = 'tile'; t.data.materials.append(TILE)
        x += 0.15
for k in range(FLOORS):
    zb = H0 + k * HF - 0.05
    box('tile_bed', TILE, X0, X1, -0.12, 0.02, zb - 0.1, zb + 0.02)
    tile_row(lambda x, zb=zb: zb + 0.03)
tile_row(lambda x: wave(x) + 0.04, -0.05)

# windows: few, wide, many small panes, cream frames; most dark, a couple dimly lit
def window(x, z, w, h, lit):
    box('glass', LIT if lit else GLASS, x - w / 2, x + w / 2, -0.03, -0.01, z, z + h)
    t, d = 0.07, -0.08
    box('frame', TRIM, x - w / 2 - t, x + w / 2 + t, d, -0.01, z - t, z)
    box('frame', TRIM, x - w / 2 - t, x + w / 2 + t, d, -0.01, z + h, z + h + t)
    box('frame', TRIM, x - w / 2 - t, x - w / 2, d, -0.01, z, z + h)
    box('frame', TRIM, x + w / 2, x + w / 2 + t, d, -0.01, z, z + h)
    for k in range(1, 3): box('frame', TRIM, x - w / 2 + k * w / 3 - 0.02, x - w / 2 + k * w / 3 + 0.02, d, -0.01, z, z + h)
    for k in range(1, 5): box('frame', TRIM, x - w / 2, x + w / 2, d, -0.01, z + k * h / 5 - 0.015, z + k * h / 5 + 0.015)
    box('sill', TILE, x - w / 2 - 0.12, x + w / 2 + 0.12, -0.18, 0.0, z - 0.14, z - 0.06)
lit_plan = {(0, 1), (1, 0), (2, 2)}  # one lit room visible from the door
for f in range(FLOORS):
    z = H0 + f * HF + 0.85
    for i, (x, w) in enumerate([(-9.6, 2.6), (-2.2, 2.0), (2.2, 2.6)]):
        window(x, z, w, 1.45, (f, i) in lit_plan)

# ground floor: one dark shopfront each side (closed for the night, faint light inside)
for sx0, sx1 in [(-11.6, -3.0), (2.6, 8.2)]:
    box('shop_glass', SHOP, sx0, sx1, -0.03, 0.0, 0.55, 2.9)
    n = max(2, int((sx1 - sx0) / 2.2))
    for k in range(n + 1):
        x = sx0 + k * (sx1 - sx0) / n
        box('shop_frame', DARK, x - 0.05, x + 0.05, -0.08, 0.0, 0.5, 2.95)
    box('shop_frame', DARK, sx0, sx1, -0.08, 0.0, 0.45, 0.58)
    box('shop_frame', DARK, sx0, sx1, -0.08, 0.0, 2.88, 2.98)

# ---------------------------------------------------------------- the street: dark, plain
box('sidewalk', PAVE, -30, 30, -4.6, 0.0, -0.05, 0.0)
box('kerb', KERB, -30, 30, -4.75, -4.6, -0.18, 0.0)
box('road', ROAD, -30, 30, -22, -4.75, -0.2, -0.18)
for x in [-7.0, -3.2, 3.2, 7.0, 10.5, -10.5]:  # Amsterdammertjes along the kerb
    cyl('bollard', BOLLARD, x, -4.35, 0, 0.75, 0.065, r_top=0.055)
    sphere('bollard_top', BOLLARD, x, -4.35, 0.78, 0.065)

# trees: slender trunk, branching crown, airy leaf cards (like the reference street)
def tree(tx, ty, height):
    cyl('trunk', BARK, tx, ty, 0, height * 0.45, 0.14, 10, r_top=0.08)
    tips = []
    def branch(p, d, length, r, depth):
        q = p + d * length
        tube('branch', BARK, p, q, r, 6)
        if depth == 0: tips.append(q); return
        for _ in range(3):
            nd = (d + Vector((random.uniform(-0.8, 0.8), random.uniform(-0.8, 0.8), random.uniform(0.1, 0.7)))).normalized()
            branch(q, nd, length * random.uniform(0.6, 0.8), r * 0.62, depth - 1)
    base = Vector((tx, ty, height * 0.4))  # crown starts low, like the street trees in the reference
    for k in range(4):
        a = k / 4 * math.tau + random.uniform(-0.3, 0.3)
        branch(base, Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 1)).normalized(), height * 0.2, 0.06, 2)
    # leaf cards scattered around the branch tips
    me = bpy.data.meshes.new('leaves'); ob = link(bpy.data.objects.new('leaves', me)); bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    for tip in tips:
        for _ in range(12):
            c = tip + Vector((random.uniform(-0.8, 0.8), random.uniform(-0.8, 0.8), random.uniform(-0.6, 0.7)))
            s = random.uniform(0.45, 0.75); a = random.uniform(0, math.pi); tilt = random.uniform(-0.6, 0.6)
            u = Vector((math.cos(a), math.sin(a), 0)) * s; v = Vector((-math.sin(a) * math.sin(tilt), math.cos(a) * math.sin(tilt), math.cos(tilt))) * s
            vs = [bm.verts.new(c - u - v), bm.verts.new(c + u - v), bm.verts.new(c + u + v), bm.verts.new(c - u + v)]
            f = bm.faces.new(vs)
            for l, (uu, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): l[uv].uv = (uu, vv)
    bm.to_mesh(me); bm.free(); me.materials.append(LEAF)
tree(-3.0, -3.6, 7.2)
tree(3.4, -3.6, 7.6)

# bikes: a proper road bike (drop bars, spoked wheels), parked against the facade, right of the door
def bike(x, frame_mat, flip=False):
    s = -1 if flip else 1
    P = lambda bx, bz, y=0.0: Vector((x + s * bx, -0.42 + y, bz))
    rear, front, bb = P(-0.5, 0.34), P(0.5, 0.34), P(-0.06, 0.29)
    seat, head_t, head_b = P(-0.17, 0.86), P(0.36, 0.84), P(0.4, 0.68)
    for hub in (rear, front):
        bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=6, major_radius=0.335, minor_radius=0.016, location=hub, rotation=(math.pi / 2, 0, 0))
        w = bpy.context.object; w.name = 'tire'; w.data.materials.append(TIRE)
        bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=4, major_radius=0.31, minor_radius=0.012, location=hub, rotation=(math.pi / 2, 0, 0))
        r = bpy.context.object; r.name = 'rim'; r.data.materials.append(TIRE)
        for k in range(16):
            a = k / 16 * math.tau
            tube('spoke', STEEL, hub, hub + Vector((math.cos(a) * 0.3, 0, math.sin(a) * 0.3)), 0.0025, 3)
        tube('hub', STEEL, hub - Vector((0, 0.05, 0)), hub + Vector((0, 0.05, 0)), 0.02, 8)
    for a, b in [(bb, seat), (seat, head_t), (bb, head_b), (bb, rear), (seat, rear), (head_t, head_b)]:
        tube('frame', frame_mat, a, b, 0.017, 8)
    tube('fork', frame_mat, head_b, front, 0.014, 8)
    tube('seatpost', STEEL, seat, P(-0.2, 0.95), 0.012, 6)
    box('saddle', SADDLE, *sorted((P(-0.33, 0).x, P(-0.08, 0).x)), -0.46, -0.38, 0.95, 1.0)
    tube('stem', STEEL, head_t, P(0.46, 0.9), 0.012, 6)
    tube('bar', BAR_TAPE, P(0.46, 0.9, -0.2), P(0.46, 0.9, 0.2), 0.012, 6)
    for y in (-0.2, 0.2):  # the drops: forward and down, curling back
        pts = [P(0.46, 0.9, y), P(0.56, 0.86, y), P(0.58, 0.76, y), P(0.5, 0.71, y)]
        for a, b in zip(pts, pts[1:]): tube('drop', BAR_TAPE, a, b, 0.012, 6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.1, depth=0.01, location=bb + Vector((0, -0.04, 0)), rotation=(math.pi / 2, 0, 0))
    cr = bpy.context.object; cr.name = 'chainring'; cr.data.materials.append(STEEL)
    tube('crank', STEEL, bb + Vector((0, -0.05, 0)), bb + Vector((s * 0.06, -0.05, -0.16)), 0.01, 6)
for bx, fm, fl in [(2.0, BIKES[0], False), (3.1, BIKES[1], True), (6.6, BIKES[2], False)]:
    bike(bx, fm, fl)

# ---------------------------------------------------------------- lights for the bake (no street lamp: darker, the neon leads)
def light(name, kind, loc, energy, color, size=0.3, rot=None):
    ld = bpy.data.lights.new(name, kind); ld.energy = energy; ld.color = color
    if kind == 'AREA': ld.size = size
    if kind == 'POINT': ld.shadow_soft_size = size
    ob = link(bpy.data.objects.new(name, ld)); ob.location = loc
    if rot: ob.rotation_euler = rot
    return ob
light('neon_sign', 'AREA', (0, -0.6, 2.95), 130, (1.0, 0.17, 0.84), 2.4, rot=(math.radians(90), 0, 0))
light('door_leak', 'POINT', (0, -0.3, 0.05), 15, (1.0, 0.17, 0.84), 0.2)
light('shop_l', 'AREA', (-7.3, -0.5, 1.8), 30, (1.0, 0.7, 0.45), 3, rot=(math.radians(90), 0, 0))
light('shop_r', 'AREA', (5.4, -0.5, 1.8), 30, (1.0, 0.7, 0.45), 3, rot=(math.radians(90), 0, 0))
light('offscreen_lamp', 'POINT', (16, -6, 5), 220, (1.0, 0.7, 0.45), 0.3)   # far down the street, out of frame
w = bpy.data.worlds.new('night'); scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.03, 0.025, 0.06, 1); bg.inputs['Strength'].default_value = 0.35

# ---------------------------------------------------------------- merge per material, UVs, bake
for ob in list(scene.objects):
    if ob.type != 'MESH': continue
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
groups = {}
for ob in list(scene.objects):
    if ob.type == 'MESH': groups.setdefault(ob.data.materials[0].name, []).append(ob)
merged = {}
for name, obs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs: ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1: bpy.ops.object.join()
    ob = bpy.context.object; ob.name = name; merged[name] = ob

def uv_world(ob, tile):
    """UV0: box projection in metres / tile, so textures repeat at real-world scale."""
    me = ob.data; bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = ob.matrix_world @ l.vert.co
            u, v = ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
            l[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me); bm.free()

BAKE = {'brick': 2048, 'pavement': 1024, 'road': 1024, 'kerb': 512, 'trim': 1024, 'tile': 1024, 'dark': 512, 'bollard': 256, 'bark': 512}
scene.render.engine = 'CYCLES'; scene.cycles.samples = 8 if QUICK else 128; scene.cycles.device = 'CPU'
scene.view_settings.view_transform = 'Standard'  # lightmaps must not be tone-mapped
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 82
for name, ob in merged.items():
    me = ob.data
    if 'tile' in me.materials[0] and name in ('brick', 'pavement', 'road'): uv_world(ob, me.materials[0]['tile'])
    elif not me.uv_layers: me.uv_layers.new(name='UVMap')
    if name not in BAKE: continue
    lm = me.uv_layers.new(name='lightmap'); me.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    size = 128 if QUICK else BAKE[name]
    img = bpy.data.images.new(f'lm_{name}', size, size, float_buffer=True)
    nt = me.materials[0].node_tree; node = nt.nodes.new('ShaderNodeTexImage'); node.image = img
    for n in nt.nodes: n.select = False
    node.select = True; nt.nodes.active = node
    print('baking', name, size, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=6, use_clear=True)
    img.save_render(os.path.join(LM, f'{name}.jpg'), scene=scene)
    nt.nodes.remove(node)
    me.uv_layers.active = me.uv_layers[0]; me.uv_layers[0].active_render = True

# ---------------------------------------------------------------- export (no images: three.js applies textures by material name)
for l in [o for o in scene.objects if o.type == 'LIGHT']: bpy.data.objects.remove(l)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'street.glb'), export_format='GLB', use_selection=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='NONE',
                          export_lights=False, export_cameras=False, export_apply=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
print('exported', os.path.join(OUT, 'street.glb'), flush=True)
