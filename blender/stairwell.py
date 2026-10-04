# Builds the stairwell in Blender, bakes its light into lightmaps and exports public/models/stairwell.glb
# + public/models/lightmaps/stair_*.jpg. Same measurements as src/entrance/world.ts.
# The only light comes from what glows: the ceiling between the black panels (Sunset rave gradient), the neon step
# edges, the neon balusters and the orange frame around the roof door. Those emitters are bake-only: three.js draws
# (and pulses) its own versions; the .glb holds the lit surfaces (walls, steps, ceiling panels, roof door).
# Run: blender -b --factory-startup --python blender/stairwell.py   (add -- --quick for a fast test bake)
#
# Coordinates: all geometry is written in three.js coordinates (y up, the climb goes toward -z) and converted with
# T(): glTF export turns Blender (x, y, z) into three.js (x, z, -y), so three.js (x, y, z) = Blender (x, -z, y).
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
LM = os.path.join(OUT, 'lightmaps')
os.makedirs(LM, exist_ok=True)
QUICK = '--quick' in sys.argv
# each lightmap is scaled so its brightest 1% sits just below 1 (JPEG can't hold more); the scale goes into
# lightmaps/stair.json and world.ts divides it out again
exposures = {}

# ---------------------------------------------------------------- the stairwell's measurements (as in world.ts)
N, RISE, RUN, W, Z0 = 36, 0.24, 0.26, 2.0, -1.0
TOP_Y, TOP_Z = N * RISE, Z0 - N * RUN
ROOF_Z, CEIL, IN = TOP_Z - 1.6, 3.0, -0.41
PINK, ORANGE = (1.0, 0.169, 0.839), (1.0, 0.302, 0.0)   # PAL.b, PAL.a (sRGB)

def srgb2lin(c): return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)
def mix(a, b, t): return tuple(x + (y - x) * t for x, y in zip(a, b))
def climb(z):  # pink at the bottom of the stairs, orange at the top (linear light)
    return srgb2lin(mix(PINK, ORANGE, min(1, max(0, (Z0 - z) / (Z0 - ROOF_Z)))))
def stair_y(z): return min(N, max(0, (Z0 - z) / RUN)) * RISE
def floor_y(z): return 0 if z > Z0 else TOP_Y if z < TOP_Z else stair_y(z)
def cy(z): return floor_y(z) + CEIL
def T(x, y, z): return Vector((x, -z, y))

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
def mat(name, rgb, rough=0.6, metal=0.0, emit=None, strength=0.0, attr_emit=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit or attr_emit:
        b.inputs['Emission Strength'].default_value = strength
        if attr_emit:  # emission colour per vertex (the gradient)
            a = nt.nodes.new('ShaderNodeAttribute'); a.attribute_name = 'glow'; a.attribute_type = 'GEOMETRY'
            nt.links.new(a.outputs['Color'], b.inputs['Emission Color'])
        else:
            b.inputs['Emission Color'].default_value = (*emit, 1)
    return m

BRICK = mat('stair_brick', (0.30, 0.12, 0.08), 0.9)          # base colours only matter for bounce light
FLOOR = mat('stair_floor', (0.06, 0.055, 0.075), 0.35)
PANEL = mat('ceil_panel', (0.02, 0.018, 0.022), 0.8)
DOOR = mat('roof_door', (0.025, 0.024, 0.027), 0.8)          # plain matte black
HANDLE = mat('roof_handle', (0.6, 0.6, 0.62), 0.25)           # baked matte (metal has no diffuse light); three.js makes it metal
GLOW = mat('glow_ceiling', (0, 0, 0), 1, 0, strength=4.0, attr_emit=True)
NEON = mat('glow_neon', (0, 0, 0), 1, 0, strength=6.0, attr_emit=True)
FRAME = mat('glow_frame', (0, 0, 0), 1, 0, emit=srgb2lin(ORANGE), strength=10.0)
BAKED = ['stair_brick', 'stair_floor', 'ceil_panel', 'roof_door', 'roof_handle']   # exported + baked
EMITTERS = ['glow_ceiling', 'glow_neon', 'glow_frame']                              # bake-only

# ---------------------------------------------------------------- mesh building (faces collected per object)
meshes = {}
def bm_for(name, m):
    if name not in meshes:
        bm = bmesh.new(); meshes[name] = (bm, m, bm.verts.layers.float_color.new('glow'))
    return meshes[name]

def face(name, m, pts, color=None):
    """A polygon given in three.js coordinates (counter-clockwise seen from the side it faces)."""
    bm, _, glow = bm_for(name, m)
    vs = [bm.verts.new(T(*p)) for p in pts]
    for v in vs: v[glow] = (*(color or (0, 0, 0)), 1)
    bm.faces.new(vs)

def box(name, m, c, size, axes=None, color=None):
    """A box centred at c (three.js), size (sx, sy, sz) along axes (three.js unit vectors, default x/y/z)."""
    ax = axes or (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))
    c = Vector(c); h = [ax[i] * size[i] / 2 for i in range(3)]
    corner = lambda sx, sy, sz: tuple(c + h[0] * sx + h[1] * sy + h[2] * sz)
    for f in [((1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)), ((-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, -1, -1)),
              ((-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)), ((-1, -1, 1), (-1, -1, -1), (1, -1, -1), (1, -1, 1)),
              ((-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)), ((1, -1, -1), (-1, -1, -1), (-1, 1, -1), (1, 1, -1))]:
        face(name, m, [corner(*p) for p in f], color)

def cylinder(name, m, a, b, r, color=None, seg=8):
    a, b = Vector(a), Vector(b); d = (b - a).normalized()
    u = d.cross(Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))).normalized(); v = d.cross(u)
    ring = lambda p: [p + (u * math.cos(k / seg * math.tau) + v * math.sin(k / seg * math.tau)) * r for k in range(seg)]
    ra, rb = ring(a), ring(b)
    for k in range(seg):
        face(name, m, [tuple(ra[k]), tuple(ra[(k + 1) % seg]), tuple(rb[(k + 1) % seg]), tuple(rb[k])], color)

# ---------------------------------------------------------------- walls (brick), following the stairs
ZS = [IN, Z0, TOP_Z, ROOF_Z]
for side in (-1, 1):
    x = side * W / 2
    for za, zb in zip(ZS, ZS[1:]):
        pts = [(x, floor_y(za) - 0.3, za), (x, floor_y(zb) - 0.3, zb), (x, cy(zb) + 0.1, zb), (x, cy(za) + 0.1, za)]
        face('walls', BRICK, pts if side > 0 else pts[::-1])
# top wall with the roof door opening (faces the climb, +z)
zt, yb, yt = ROOF_Z, TOP_Y, TOP_Y + CEIL + 0.1
for x0, x1, y0, y1 in [(-W / 2, -0.55, yb, yt), (0.55, W / 2, yb, yt), (-0.55, 0.55, yb + 2.2, yt)]:
    face('walls', BRICK, [(x0, y0, zt), (x1, y0, zt), (x1, y1, zt), (x0, y1, zt)])
# door reveal (the depth of the wall around the door)
for x0, x1, y0, y1, nx in [(-0.55, -0.55, yb, yb + 2.2, 1), (0.55, 0.55, yb, yb + 2.2, -1)]:
    pts = [(x0, y0, zt), (x0, y1, zt), (x0, y1, zt - 0.2), (x0, y0, zt - 0.2)]
    face('walls', BRICK, pts if nx > 0 else pts[::-1])
face('walls', BRICK, [(-0.55, yb + 2.2, zt), (0.55, yb + 2.2, zt), (0.55, yb + 2.2, zt - 0.2), (-0.55, yb + 2.2, zt - 0.2)])

# ---------------------------------------------------------------- floor: landing, steps (treads + risers), top landing
face('floor', FLOOR, [(-W / 2, 0, IN), (W / 2, 0, IN), (W / 2, 0, Z0), (-W / 2, 0, Z0)][::-1])
for i in range(N):
    zf, zb, y0, y1 = Z0 - i * RUN, Z0 - (i + 1) * RUN, i * RISE, (i + 1) * RISE
    face('floor', FLOOR, [(-W / 2, y0, zf), (W / 2, y0, zf), (W / 2, y1, zf), (-W / 2, y1, zf)])        # riser, faces +z
    face('floor', FLOOR, [(-W / 2, y1, zf), (W / 2, y1, zf), (W / 2, y1, zb), (-W / 2, y1, zb)][::-1])  # tread, faces up
    # neon strip on the nose (bake-only light)
    box('neon', NEON, (0, y1 - 0.009, zf - 0.012), (W - 0.02, 0.018, 0.025), color=climb(zf))
face('floor', FLOOR, [(-W / 2, TOP_Y, TOP_Z), (W / 2, TOP_Y, TOP_Z), (W / 2, TOP_Y, ROOF_Z), (-W / 2, TOP_Y, ROOF_Z)][::-1])

# ---------------------------------------------------------------- neon balusters (bake-only) every other step
for i in range(0, N, 2):
    z = Z0 - i * RUN - RUN / 2
    for side in (-1, 1):
        x, y = side * (W / 2 - 0.14), (i + 1) * RISE + 0.45
        cylinder('neon', NEON, (x, y - 0.41, z), (x, y + 0.41, z), 0.016, srgb2lin(PINK))

# ---------------------------------------------------------------- ceiling: glowing gradient surface, black panels + frame in front
B, G, DEPTH = 0.16, 0.09, 0.035
PW = (W - 2 * B - 3 * G) / 2
xa = Vector((1, 0, 0))
for k in range(3):
    za, zb = ZS[k], ZS[k + 1]
    face('ceiling_glow', GLOW, [(-W / 2, cy(za), za), (-W / 2, cy(zb), zb), (W / 2, cy(zb), zb), (W / 2, cy(za), za)][::-1], None)
bm, _, glow_layer = meshes['ceiling_glow']
for v in bm.verts:
    v[glow_layer] = (*climb(-v.co.y), 1)   # Blender y = -three z

for k in range(3):
    za, zb = ZS[k], ZS[k + 1]
    p0, p1 = Vector((0, cy(za), za)), Vector((0, cy(zb), zb))
    d = p1 - p0; L = d.length; d.normalize()
    up = xa.cross(d); e3 = xa.cross(up)
    def put(x, s, w, l):
        c = p0 + d * s - up * (DEPTH / 2 + 0.004); c.x = x
        box('ceiling', PANEL, tuple(c), (w, DEPTH, l), (xa, up, e3))
    for x in (-(W - B) / 2, (W - B) / 2): put(x, L / 2, B, L)          # frame along the walls
    if k == 0: put(0, B / 2, W - 2 * B, B)
    if k == 2: put(0, L - B / 2, W - 2 * B, B)
    s0, s1 = (B + G if k == 0 else G / 2), (B + G if k == 2 else G / 2)
    n = max(1, round((L - s0 - s1 + G) / (PW + G))); ln = (L - s0 - s1 - (n - 1) * G) / n
    for i in range(n):
        for x in (-(G + PW) / 2, (G + PW) / 2): put(x, s0 + i * (ln + G) + ln / 2, PW, ln)

# ---------------------------------------------------------------- roof door: orange neon frame (bake-only), plain matte black door, lever on the right
fz = ROOF_Z + 0.02
for a, b in [((-0.57, 0), (-0.57, 2.22)), ((0.57, 0), (0.57, 2.22)), ((-0.57, 2.22), (0.57, 2.22))]:
    cylinder('frame', FRAME, (a[0], TOP_Y + a[1], fz), (b[0], TOP_Y + b[1], fz), 0.016)
dz = ROOF_Z - 0.03
box('door', DOOR, (0, TOP_Y + 1.1, dz), (1.1, 2.2, 0.05))
hx, hy, hz = 0.43, TOP_Y + 1.05, dz + 0.025
box('handle', HANDLE, (hx, hy, hz + 0.004), (0.05, 0.18, 0.008))                 # back plate
cylinder('handle', HANDLE, (hx, hy + 0.04, hz + 0.008), (hx, hy + 0.04, hz + 0.06), 0.009)
cylinder('handle', HANDLE, (hx + 0.005, hy + 0.04, hz + 0.06), (hx - 0.13, hy + 0.04, hz + 0.06), 0.011)  # lever points toward the hinge side

# ---------------------------------------------------------------- objects
objs = {}
for name, (bm, m, _) in meshes.items():
    bm.normal_update()
    if name in ('walls', 'floor'):  # room surfaces face the inside of the stairwell
        for f in bm.faces:
            c = f.calc_center_median(); z3 = -c.y                    # back to three.js z
            inside = T(0, floor_y(z3) + 1.5, z3 + 0.5)
            if f.normal.dot(inside - c) < 0: f.normal_flip()
    else:                           # closed boxes and tubes face outward
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.normal_update(); bm.to_mesh(me); bm.free()
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob); objs[name] = ob
objs['door'].name = 'roof_leaf'; objs['handle'].name = 'roof_handle'

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
scene.cycles.samples = 16 if QUICK else 1024
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 90
w = bpy.data.worlds.new('dark'); scene.world = w; w.use_nodes = True
bgn = next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND'); bgn.inputs['Strength'].default_value = 0.0

SIZES = {'walls': 2048, 'floor': 2048, 'ceiling': 1024, 'roof_leaf': 512, 'roof_handle': 128}
for name, ob in [(n, o) for n, o in objs.items() if o.name in ('walls', 'floor', 'ceiling', 'roof_leaf', 'roof_handle')]:
    me = ob.data
    uv_world(ob, 1.6 if ob.name == 'walls' else 1.0)
    lm = me.uv_layers.new(name='lightmap'); me.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    size = 128 if QUICK else SIZES[ob.name]
    img = bpy.data.images.new(f'lm_{ob.name}', size, size, float_buffer=True)
    nt = me.materials[0].node_tree; node = nt.nodes.new('ShaderNodeTexImage'); node.image = img
    for n in nt.nodes: n.select = False
    node.select = True; nt.nodes.active = node
    print('baking', ob.name, size, flush=True)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=8, use_clear=True)
    px = np.array(img.pixels[:]).reshape(-1, 4)
    print('  max', px[:, :3].max(), 'p99', np.percentile(px[:, :3].max(axis=1), 99), flush=True)
    p99 = float(np.percentile(px[:, :3].max(axis=1), 99.5)) or 1.0
    exposures[ob.name] = 0.92 / p99
    px[:, :3] *= exposures[ob.name]; img.pixels[:] = px.ravel()
    img.save_render(os.path.join(LM, f'stair_{ob.name}.jpg'), scene=scene)
    nt.nodes.remove(node)
    me.uv_layers.active = me.uv_layers[0]; me.uv_layers[0].active_render = True

json.dump(exposures, open(os.path.join(LM, 'stair.json'), 'w'), indent=1)

# ---------------------------------------------------------------- export the lit surfaces only (the emitters are drawn by three.js)
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
    if ob.type == 'MESH' and ob.data.materials[0].name in BAKED: ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'stairwell.glb'), export_format='GLB', use_selection=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='NONE',
                          export_attributes=False, export_lights=False, export_cameras=False,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7)
print('exported', os.path.join(OUT, 'stairwell.glb'), flush=True)
